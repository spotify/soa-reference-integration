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

import { requestClientAccessToken, requestUserAccessToken } from "../client";
import fetch from "node-fetch";

const { Response } = jest.requireActual("node-fetch");
jest.mock("node-fetch", () => jest.fn());
jest.mock("../config", () => jest.fn());

describe("helpers", () => {
  describe("userAccessToken", () => {
    it("successfully receives access token", async () => {
      const accessTokenResponse = {
        access_token: "NgCXRK...MzYjw",
        token_type: "Bearer",
        scope: "user-read-private user-read-email",
        expires_in: 3600,
        refresh_token: "NgAagA...Um_SHo",
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(accessTokenResponse))
      );
      const response = await requestUserAccessToken("code", "state");

      expect(fetch).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        expect.anything()
      );
      expect(response).toEqual(accessTokenResponse);
    });
  });

  describe("clientAccessToken", () => {
    it("successfully receives access token", async () => {
      const accessTokenResponse = {
        access_token: "NgCXRKc...MzYjw",
        token_type: "bearer",
        expires_in: 3600,
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(
        new Response(JSON.stringify(accessTokenResponse))
      );
      const response = await requestClientAccessToken(
        "soa-manage-entitlements"
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://accounts.spotify.com/api/token",
        expect.anything()
      );
      expect(response).toEqual(accessTokenResponse);
    });
  });
});
