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
import { requestClientAccessToken, requestUserAccessToken } from "../client";

const { Response } = jest.requireActual("node-fetch");

type AccessTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
};

jest.mock("node-fetch", () => jest.fn());
jest.mock("../config", () => ({
  CALLBACK_URL: "callback_url",
  CLIENT_ID: "client_id",
  CLIENT_SECRET: "client_secret",
}));
jest.mock("../client", () => ({
  requestUserAccessToken: jest.fn(),
  requestClientAccessToken: jest.fn(),
}));

const MOCKED_USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaa1";
const MOCKED_ENCODED_USER_ID = "encodedMockedUserId";
const MOCKED_RANDOM_STRING = "mockedRandomString";
const MOCKED_ENCODED_RANDOM_STRING = "encodedMockedRandomString";
jest.mock("../middleware", (): { authenticated: RequestHandler } => ({
  authenticated: (req, res, next) => {
    req.userId = MOCKED_USER_ID;
    next();
  },
}));
const fetchMock = fetch as jest.MockedFunction<typeof fetch>;
const requestClientAccessTokenMock =
  requestClientAccessToken as jest.MockedFunction<
    typeof requestClientAccessToken
  >;
const requestUserAccessTokenMock =
  requestUserAccessToken as jest.MockedFunction<typeof requestUserAccessToken>;

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
    beforeEach(() => {
      jest
        .spyOn(jwt, "sign")
        .mockImplementation(() => MOCKED_ENCODED_RANDOM_STRING);

      jest
        .spyOn(jwt, "verify")
        .mockImplementationOnce(() => MOCKED_RANDOM_STRING);
    });

    it("redirects to callback", async () => {
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

      const res = await agent
        .post("/api/login")
        .send({ userId: MOCKED_USER_ID });

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
          "lunar_industries__user=" + MOCKED_USER_ID,
          "is_authenticated=" + true,
        ]);

      expect(res.headers["set-cookie"][0]).toEqual(
        expect.not.stringContaining(MOCKED_USER_ID)
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

    it("correctly calls Open Access to register user and redirects to completion url", async () => {
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

      requestUserAccessTokenMock.mockResolvedValueOnce(accessTokenResponse);
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(registerUserResponse))
      );

      const response = await agent
        .get("/api/callback")
        .query({ state: MOCKED_RANDOM_STRING, code: "authentication code" })
        .set("Cookie", ["spotify_auth_state=" + MOCKED_ENCODED_RANDOM_STRING]);

      const expectedRequest = {
        method: "POST",
        body: jwt.sign(
          {
            partner_id: "partner_id",
            partner_user_id: MOCKED_USER_ID,
            entitlements: [
              "bonus-tier-subscribers",
              "premium-tier-subscribers",
            ],
          },
          "client_secret",
          { algorithm: "HS256" }
        ),
        headers: {
          Authorization: "Bearer " + accessTokenResponse.access_token,
          "Content-Type": "jwt",
        },
      };

      expect(requestUserAccessToken).toHaveBeenCalledWith(
        "authentication code",
        "mockedRandomString"
      );
      expect(fetch).toHaveBeenCalledWith(
        "https://open-access.spotify.com/api/v1/register-user",
        expectedRequest
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
        .query({ state: "a different state", code: "authentication code" })
        .set("Cookie", ["spotify_auth_state=incorrectStateString"]);

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "state_mismatch" });
    });

    it("fails if code is missing", async () => {
      const response = await agent
        .get("/api/callback")
        .query({ state: MOCKED_RANDOM_STRING })
        .set("Cookie", ["spotify_auth_state=" + MOCKED_ENCODED_RANDOM_STRING]);

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "missing_code" });
    });
  });

  describe("POST /user-spotify-unlink", () => {
    let clientAccessTokenResponse: AccessTokenResponse;
    beforeEach(() => {
      clientAccessTokenResponse = {
        access_token: "NgCXRK...MzYjw",
        token_type: "Basic",
        scope: "user-soa-unlink",
        expires_in: 3600,
        refresh_token: "NgAagA...Um_SHo",
      };

      requestClientAccessTokenMock.mockResolvedValueOnce(
        clientAccessTokenResponse
      );
    });

    it("correctly calls Open Access to unlink user on SOA", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null));

      const response = await agent.post("/api/user-spotify-unlink");

      const expectedRequest = {
        method: "POST",
        body: jwt.sign(
          { partner_id: "partner_id", partner_user_id: MOCKED_USER_ID },
          "client_secret",
          { algorithm: "HS256" }
        ),
        headers: {
          Authorization: "Bearer " + clientAccessTokenResponse.access_token,
          "Content-Type": "jwt",
        },
      };

      expect(requestClientAccessToken).toHaveBeenCalledWith("user-soa-unlink");

      expect(fetch).toHaveBeenCalledWith(
        "https://open-access.spotify.com/api/v1/unlink-user",
        expectedRequest
      );

      expect(response.status).toEqual(204);
    });

    it("fails if user is not linked", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
      const response = await agent.post("/api/user-spotify-unlink");

      expect(response.status).toEqual(404);
      expect(response.body).toStrictEqual({ error: "User is not linked" });
    });

    it("fails if client credentials are invalid", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
      const response = await agent.post("/api/user-spotify-unlink");

      expect(response.status).toEqual(403);
      expect(response.body).toStrictEqual({ error: "Client unauthorized" });
    });

    it("fails if request to SOA is malformed", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
      const response = await agent.post("/api/user-spotify-unlink");

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "Malformed request" });
    });

    it("fails if SOA returns unexpected response", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
      const response = await agent.post("/api/user-spotify-unlink");

      expect(response.status).toEqual(500);
      expect(response.body).toStrictEqual({
        error: "Unexpected response from Spotify",
      });
    });
  });

  describe("GET /user-spotify-entitlements", () => {
    let clientAccessTokenResponse: AccessTokenResponse;
    beforeEach(() => {
      clientAccessTokenResponse = {
        access_token: "NgCXRK...MzYjw",
        token_type: "Basic",
        scope: "soa-manage-entitlements",
        expires_in: 3600,
        refresh_token: "NgAagA...Um_SHo",
      };

      requestClientAccessTokenMock.mockResolvedValueOnce(
        clientAccessTokenResponse
      );
    });

    it("correctly calls Open Access and returns successful response", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ entitlements: "bonus-tier-subscribers" }))
      );

      const response = await agent.get("/api/user-spotify-entitlements");

      const expectedRequest = {
        method: "POST",
        body: jwt.sign(
          { partner_id: "partner_id", partner_user_id: MOCKED_USER_ID },
          "client_secret",
          { algorithm: "HS256" }
        ),
        headers: {
          Authorization: "Bearer " + clientAccessTokenResponse.access_token,
          "Content-Type": "jwt",
        },
      };

      expect(requestClientAccessToken).toHaveBeenCalledWith(
        "soa-manage-entitlements"
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://open-access.spotify.com/api/v1/get-entitlements",
        expectedRequest
      );

      expect(response.status).toEqual(200);
    });

    it("fails if user is not linked", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
      const response = await agent.get("/api/user-spotify-entitlements");

      expect(response.status).toEqual(404);
      expect(response.body).toStrictEqual({ error: "User is not linked" });
    });

    it("fails if required scope is missing", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
      const response = await agent.get("/api/user-spotify-entitlements");

      expect(response.status).toEqual(403);
      expect(response.body).toStrictEqual({ error: "Client unauthorized" });
    });

    it("fails if request is malformed", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
      const response = await agent.get("/api/user-spotify-entitlements");

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "Malformed request" });
    });

    it("fails if SOA returns unexpected response", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
      const response = await agent.get("/api/user-spotify-entitlements");

      expect(response.status).toEqual(500);
      expect(response.body).toStrictEqual({
        error: "Unexpected response from Spotify",
      });
    });
  });

  describe("POST /user-spotify-add-entitlements", () => {
    let clientAccessTokenResponse: AccessTokenResponse;
    beforeEach(() => {
      clientAccessTokenResponse = {
        access_token: "NgCXRK...MzYjw",
        token_type: "Basic",
        scope: "soa-manage-entitlements",
        expires_in: 3600,
        refresh_token: "NgAagA...Um_SHo",
      };

      requestClientAccessTokenMock.mockResolvedValueOnce(
        clientAccessTokenResponse
      );
    });

    it("correctly calls Open Access to add user entitlements", async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(null)));

      const response = await agent
        .post("/api/user-spotify-add-entitlements")
        .send({
          entitlements: ["test-entitlements"],
        });

      const expectedRequest = {
        method: "POST",
        body: jwt.sign(
          {
            partner_id: "partner_id",
            partner_user_id: MOCKED_USER_ID,
            entitlements: ["test-entitlements"],
          },
          "client_secret",
          { algorithm: "HS256" }
        ),
        headers: {
          Authorization: "Bearer " + clientAccessTokenResponse.access_token,
          "Content-Type": "jwt",
        },
      };

      expect(requestClientAccessToken).toHaveBeenCalledWith(
        "soa-manage-entitlements"
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://open-access.spotify.com/api/v1/add-entitlements",
        expectedRequest
      );

      expect(response.status).toEqual(204);
    });

    it("fails if user is not linked", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
      const response = await agent.post("/api/user-spotify-add-entitlements");

      expect(response.status).toEqual(404);
      expect(response.body).toStrictEqual({ error: "User is not linked" });
    });

    it("fails if scope required is missing", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
      const response = await agent.post("/api/user-spotify-add-entitlements");

      expect(response.status).toEqual(403);
      expect(response.body).toStrictEqual({ error: "Client unauthorized" });
    });

    it("fails for malformed requests", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
      const response = await agent.post("/api/user-spotify-add-entitlements");

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "Malformed request" });
    });

    it("fails if SOA returns unexpected response", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
      const response = await agent.post("/api/user-spotify-add-entitlements");

      expect(response.status).toEqual(500);
      expect(response.body).toStrictEqual({
        error: "Unexpected response from Spotify",
      });
    });
  });

  describe("POST /user-spotify-replace-entitlements", () => {
    let clientAccessTokenResponse: AccessTokenResponse;
    beforeEach(() => {
      clientAccessTokenResponse = {
        access_token: "NgCXRK...MzYjw",
        token_type: "Basic",
        scope: "soa-manage-entitlements",
        expires_in: 3600,
        refresh_token: "NgAagA...Um_SHo",
      };

      requestClientAccessTokenMock.mockResolvedValueOnce(
        clientAccessTokenResponse
      );
    });

    it("correctly calls Spotify to replace user entitlements", async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify("")));

      const response = await agent
        .post("/api/user-spotify-replace-entitlements")
        .send({ entitlements: ["test-entitlements"] });

      const expectedRequest = {
        method: "POST",
        body: jwt.sign(
          {
            partner_id: "partner_id",
            partner_user_id: MOCKED_USER_ID,
            entitlements: ["test-entitlements"],
          },
          "client_secret",
          { algorithm: "HS256" }
        ),
        headers: {
          Authorization: "Bearer " + clientAccessTokenResponse.access_token,
          "Content-Type": "jwt",
        },
      };

      expect(requestClientAccessToken).toHaveBeenCalledWith(
        "soa-manage-entitlements"
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://open-access.spotify.com/api/v1/replace-entitlements",
        expectedRequest
      );

      expect(response.status).toEqual(204);
    });

    it("fails if user is not linked", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
      const response = await agent.post(
        "/api/user-spotify-replace-entitlements"
      );

      expect(response.status).toEqual(404);
      expect(response.body).toStrictEqual({ error: "User is not linked" });
    });

    it("fails if scope for request is missing", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
      const response = await agent.post(
        "/api/user-spotify-replace-entitlements"
      );

      expect(response.status).toEqual(403);
      expect(response.body).toStrictEqual({ error: "Client unauthorized" });
    });

    it("fails if malformed requests", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
      const response = await agent.post(
        "/api/user-spotify-replace-entitlements"
      );

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "Malformed request" });
    });

    it("fails if response is unexpected", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
      const response = await agent.post(
        "/api/user-spotify-replace-entitlements"
      );

      expect(response.status).toEqual(500);
      expect(response.body).toStrictEqual({
        error: "Unexpected response from Spotify",
      });
    });
  });

  describe("POST /user-spotify-delete-entitlements", () => {
    let clientAccessTokenResponse: AccessTokenResponse;
    beforeEach(() => {
      clientAccessTokenResponse = {
        access_token: "NgCXRK...MzYjw",
        token_type: "Basic",
        scope: "soa-manage-entitlements",
        expires_in: 3600,
        refresh_token: "NgAagA...Um_SHo",
      };

      requestClientAccessTokenMock.mockResolvedValueOnce(
        clientAccessTokenResponse
      );
    });

    it("correctly calls Open Access to delete user entitlements", async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(null)));

      const response = await agent
        .post("/api/user-spotify-delete-entitlements")
        .send({ entitlements: ["test-entitlements"] });

      const expectedRequest = {
        method: "POST",
        body: jwt.sign(
          {
            partner_id: "partner_id",
            partner_user_id: MOCKED_USER_ID,
            entitlements: ["test-entitlements"],
          },
          "client_secret",
          { algorithm: "HS256" }
        ),
        headers: {
          Authorization: "Bearer " + clientAccessTokenResponse.access_token,
          "Content-Type": "jwt",
        },
      };

      expect(requestClientAccessToken).toHaveBeenCalledWith(
        "soa-manage-entitlements"
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://open-access.spotify.com/api/v1/delete-entitlements",
        expectedRequest
      );

      expect(response.status).toEqual(204);
    });

    it("fails if user is not linked", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
      const response = await agent.post(
        "/api/user-spotify-delete-entitlements"
      );

      expect(response.status).toEqual(404);
      expect(response.body).toStrictEqual({ error: "User is not linked" });
    });

    it("fails if scope for request is missing", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
      const response = await agent.post(
        "/api/user-spotify-delete-entitlements"
      );

      expect(response.status).toEqual(403);
      expect(response.body).toStrictEqual({ error: "Client unauthorized" });
    });

    it("fails if malformed requests", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
      const response = await agent.post(
        "/api/user-spotify-delete-entitlements"
      );

      expect(response.status).toEqual(400);
      expect(response.body).toStrictEqual({ error: "Malformed request" });
    });

    it("fails if response from SOA unexpected", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
      const response = await agent.post(
        "/api/user-spotify-delete-entitlements"
      );

      expect(response.status).toEqual(500);
      expect(response.body).toStrictEqual({
        error: "Unexpected response from Spotify",
      });
    });
  });
});
