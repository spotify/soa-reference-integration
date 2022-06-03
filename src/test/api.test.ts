/*
 * Copyright 2022 Spotify AB
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import supertest from "supertest";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import * as utils from "../helpers";
import { setup } from "../setup";
import { RequestHandler } from "express";

const { Response } = jest.requireActual("node-fetch");

jest.mock("node-fetch", () => jest.fn());
jest.mock("../config", () => ({
  CALLBACK_URL: "callback_url",
  CLIENT_ID: "client_id",
}));
const MOCKED_USER = "aaaaaaaaaaaaaaaaaaaaaaaaaaa1";
jest.mock("../middleware", (): { authenticated: RequestHandler } => ({
  authenticated: (req, res, next) => {
    req.userId = MOCKED_USER;
    next();
  },
}));

const MOCKED_ENCODED_USER_ID = "encodedMockedUserId";
const MOCKED_RANDOM_STRING = "mockedRandomString";
const ENCODED_MOCKED_RANDOM_STRING = "encodedMockedRandomString";

const app = setup();
let agent: supertest.SuperTest<supertest.Test>;

describe("api", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    agent = supertest(app);

    // Mock our helper function that generates a random string
    jest
      .spyOn(utils, "generateRandomString")
      .mockReturnValue(MOCKED_RANDOM_STRING);
  });

  describe("GET /entrypoint", () => {
    it("redirects to callback", async () => {
      jest
        .spyOn(jwt, "sign")
        .mockImplementation(() => ENCODED_MOCKED_RANDOM_STRING);

      const res = await agent.get("/api/entrypoint");

      const [baseUrl, query] = res.headers.location.split("?");
      const queryParameters = new URLSearchParams(query);

      expect(res.status).toEqual(302);
      expect(baseUrl).toBe("https://accounts.spotify.com/authorize");
      expect(Object.fromEntries(queryParameters)).toEqual({
        client_id: "client_id",
        response_type: "code",
        redirect_uri: "callback_url",
        state: MOCKED_RANDOM_STRING,
        scope: "user-soa-link",
      });
    });
  });

  describe("GET /login", () => {
    it("sets the cookie and returns 200", async () => {
      jest.spyOn(jwt, "sign").mockImplementation(() => MOCKED_ENCODED_USER_ID);

      const res = await agent.post("/api/login").send({ userId: MOCKED_USER });

      expect(res.status).toEqual(200);
      expect(res.headers["set-cookie"][0]).toContain(
        "lunar_industries__user=" + MOCKED_ENCODED_USER_ID
      );
      expect(res.headers["set-cookie"][1]).toContain("is_authenticated=true");
    });

    it("returns 400 Bad Request when user id is missing", async () => {
      const res = await agent.post("/api/login");
      expect(res.status).toEqual(400);
    });

    it("returns 400 Bad Request when user id is malformed", async () => {
      const res = await agent
        .post("/api/login")
        .send({ userId: "invalid_user_id" });
      expect(res.status).toEqual(400);
    });
  });

  describe("GET /logout", () => {
    it("clears the cookie storing user id", async () => {
      const res = await agent
        .get("/api/logout")
        .set("Cookie", [
          "lunar_industries__user=" + MOCKED_USER,
          "is_authenticated=" + true,
        ]);

      expect(res.headers["set-cookie"][0]).toEqual(
        expect.not.stringContaining(MOCKED_USER)
      );
      expect(res.headers["set-cookie"][1]).toEqual(
        expect.not.stringContaining("true")
      );
    });
  });

  describe("GET /callback", () => {
    beforeEach(() => {
      jest
        .spyOn(jwt, "verify")
        .mockImplementationOnce(() => MOCKED_RANDOM_STRING);
    });

    it("successfully registers user on OAP and redirect to completion url", async () => {
      const accessTokenResponse = {
        access_token: "NgCXRK...MzYjw",
        token_type: "Bearer",
        scope: "user-read-private user-read-email",
        expires_in: 3600,
        refresh_token: "NgAagA...Um_SHo",
      };

      const registerUserResponse = {
        completion_url: "https://success-page.com",
      };

      (fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce(
          new Response(JSON.stringify(accessTokenResponse))
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(registerUserResponse))
        );

      const response = await agent
        .get("/api/callback")
        .query({ state: MOCKED_RANDOM_STRING, code: "authentication code" })
        .set("Cookie", ["spotify_auth_state=" + ENCODED_MOCKED_RANDOM_STRING]);

      expect(fetch).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        expect.anything()
      );
      expect(fetch).toHaveBeenCalledWith(
        "https://open-access.spotify.com/api/v1/register-user",
        expect.anything()
      );

      expect(response.status).toEqual(302);
      expect(response.headers.location).toBe("https://success-page.com");
    });

    it("fails if state is missing", async () => {
      const response = await agent
        .get("/api/callback")
        .query({ code: "authentication code" });

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "state_mismatch" });
    });

    it("fails if state is not same as stored state", async () => {
      const response = await agent
        .get("/api/callback")
        .query({ code: "authentication code" })
        .set("Cookie", ["spotify_auth_state=incorrectStateString"]);

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "state_mismatch" });
    });

    it("fails if code is missing", async () => {
      const response = await agent
        .get("/api/callback")
        .query({ state: MOCKED_RANDOM_STRING })
        .set("Cookie", ["spotify_auth_state=" + ENCODED_MOCKED_RANDOM_STRING]);

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "missing_code" });
    });
  });
});
