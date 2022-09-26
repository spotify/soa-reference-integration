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

import fetch from "node-fetch";
import { CALLBACK_URL, CLIENT_ID, CLIENT_SECRET } from "./config";

/*
Requests a user access token from the Spotify Authorization Service
For more information: https://developer.spotify.com/documentation/general/guides/authorization/code-flow#request-access-token
*/
export const requestUserAccessToken = async (code: string, state: string) => {
  const params = new URLSearchParams();
  params.append("code", code);
  params.append("state", state);
  params.append("redirect_uri", CALLBACK_URL);
  params.append("grant_type", "authorization_code");

  const request = {
    method: "POST",
    body: params,
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    request
  );
  return await response.json();
};

/*
For server-to-server communication, the Spotify Client Credentials Flow is used to receive the access token
For more information: https://developer.spotify.com/documentation/general/guides/authorization/client-credentials
 */
export const requestClientAccessToken = async (scope: string) => {
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("scope", scope);

  const request = {
    method: "POST",
    body: params,
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  const response = await fetch(
    "https://accounts.spotify.com/api/token",
    request
  );
  return await response.json();
};
