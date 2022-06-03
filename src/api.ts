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

import { Router } from "express";
import { authenticated } from "./middleware";
import fetch from "node-fetch";
import { generateRandomString, isValidUserId } from "./helpers";
import jwt from "jsonwebtoken";
import { requestUserAccessToken } from "./client";
import {
  CALLBACK_URL,
  CLIENT_ID,
  CLIENT_SECRET,
  LOCAL_SECRET,
  PARTNER_ID,
} from "./config";

const api = Router();

// Options for cookies only accessible through HTTP
const HTTP_ONLY = {
  maxAge: 900000,
  httpOnly: true,
  secure: true,
};

// Option for cookies accessible through JavaScript, this is used by the web interface
const ACCESSIBLE_IN_JAVASCRIPT = {
  maxAge: 900000,
  httpOnly: false,
};

/*
This endpoint is used to initiate the Spotify Authorization Code Flow
More information about Spotify OAuth: https://developer.spotify.com/documentation/general/guides/authorization/code-flow/
 */
api.get("/entrypoint", authenticated, (req, res) => {
  /*
  The state is optional, but strongly recommended
  In this example, we generate the state as a random string and store it encoded in a cookie
  Please consider your own security measures on how to generate and store the state
   */
  const state = generateRandomString(16);
  const encodedState = jwt.sign(state, LOCAL_SECRET, {
    algorithm: "HS256",
  });

  const queryParameters = {
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: CALLBACK_URL,
    state: state,
    scope: "user-soa-link",
  };

  res
    .cookie("spotify_auth_state", encodedState, HTTP_ONLY)
    .redirect(
      "https://accounts.spotify.com/authorize?" +
        new URLSearchParams(queryParameters).toString()
    );
});

/*
Replace this with your preferred user authentication
To keep this example implementation simple and focus on the main purpose: the integration with Spotify Open Access
our naive authorization will store the user id in a cookie. This is not intended to be reproduced in your own implementation
 */
api.post("/login", (req, res) => {
  const userId = req.body?.userId;

  if (!isValidUserId(userId)) {
    res.status(400).send();
  } else {
    const encodedUserId = jwt.sign(userId, LOCAL_SECRET, {
      algorithm: "HS256",
    });

    res
      .cookie("lunar_industries__user", encodedUserId, HTTP_ONLY)
      .cookie("is_authenticated", true, ACCESSIBLE_IN_JAVASCRIPT)
      .send();
  }
});

/*
The logout endpoint will clear the cookie where the user id is stored
 */
api.get("/logout", (req, res) => {
  res
    .clearCookie("lunar_industries__user")
    .clearCookie("is_authenticated")
    .redirect("/");
});

/*
After the user accepts the authorization request the Spotify Authorization Service will redirect back to this endpoint
The request includes the state for verification and the authorization code to be exchanged for an access token
*/
api.get("/callback", authenticated, async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  let storedState;
  try {
    storedState = jwt.verify(req.cookies["spotify_auth_state"], LOCAL_SECRET);
  } catch {
    // eslint-disable-next-line no-empty
  }

  if (state === undefined || state !== storedState) {
    return res.status(400).json({ error: "state_mismatch" });
  } else if (code === undefined) {
    return res.status(400).json({ error: "missing_code" });
  }

  /*
  The users access token is needed to register a user in the Spotify Open Access system
  To receive the access token, a request is sent to Spotify Authorization Service with the state and the authorization code
  */
  const tokenResponse = await requestUserAccessToken(
    code.toString(),
    state.toString()
  );

  /*
  The Partner User ID is the hexadecimal shared identifier between the partner and Spotify.
  For detailed information: https://developer.spotify.com/documentation/open-access/overview/#partner-user-id
  */
  const partnerUserIdHex = Buffer.from(req.userId, "base64").toString("hex");

  /*
  Payload for request to register user in the Spotify Open Access system
  For detailed information: https://developer.spotify.com/documentation/open-access/reference/#/operations/register-user
  */
  const payload = {
    partner_id: PARTNER_ID,
    partner_user_id: partnerUserIdHex,
    entitlements: ["bonus-tier-subscribers", "premium-tier-subscribers"],
  };
  const signedPayload = jwt.sign(payload, CLIENT_SECRET, {
    algorithm: "HS256",
  });

  const registerUserRequest = {
    method: "POST",
    body: signedPayload,
    headers: {
      Authorization: "Bearer " + tokenResponse.access_token,
      "Content-Type": "text/plain",
    },
  };

  const registerUserResponse = await fetch(
    "https://open-access.spotify.com/api/v1/register-user",
    registerUserRequest
  );

  /*
  A successful response will have the status code 200 and include a completion url in the body
  You always need to redirect the user to the "completion url" unchanged
  This will take the user to a landing page on Spotify, completing the linking flow
   */
  if (registerUserResponse.status == 200) {
    const response = await registerUserResponse.json();
    const completionUrl = response.completion_url;
    res.clearCookie("spotify_auth_state").redirect(completionUrl);
  } else {
    res.clearCookie("spotify_auth_state").redirect("/error.html");
  }
});

api.get("/_ping", (_req, res) => res.status(204).send());

export { api };
