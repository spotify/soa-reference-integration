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
import { requestUserAccessToken, requestClientAccessToken } from "./client";
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
  maxAge: 900_000,
  httpOnly: true,
  secure: true,
};

// Option for cookies accessible through JavaScript, this is used by the web interface
const ACCESSIBLE_IN_JAVASCRIPT = {
  maxAge: 15 * 60 * 1_000,
  httpOnly: false,
};

// Option for cookies that we want to persist for a long time
const TEN_YEAR_COOKIE = {
  maxAge: 10 * 365 * 24 * 60 * 60 * 1_000,
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
    entitlements: req.cookies["entitlements"]
      ? JSON.parse(req.cookies["entitlements"])
      : ["bonus-tier-subscribers", "premium-tier-subscribers"],
  };
  const signedPayload = jwt.sign(payload, CLIENT_SECRET, {
    algorithm: "HS256",
  });

  const registerUserRequest = {
    method: "POST",
    body: signedPayload,
    headers: {
      Authorization: "Bearer " + tokenResponse.access_token,
      "Content-Type": "jwt",
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
  if (registerUserResponse.status === 200) {
    const response = await registerUserResponse.json();
    const completionUrl = response.completion_url;
    res.clearCookie("spotify_auth_state").redirect(completionUrl);
  } else {
    res.clearCookie("spotify_auth_state").redirect("/error.html");
  }
});

api.post("/user-spotify-unlink", authenticated, async (req, res) => {
  /*
  The client access token is needed to perform the user unlinking request process.
  For more details see: https://developer.spotify.com/documentation/general/guides/authorization/client-credentials/
  */
  const clientAccessTokenResponse = await requestClientAccessToken(
    "user-soa-unlink"
  );

  const partnerUserIdHex = Buffer.from(req.userId, "base64").toString("hex");

  const payload = {
    partner_id: PARTNER_ID,
    partner_user_id: partnerUserIdHex,
  };

  const signedPayload = jwt.sign(payload, CLIENT_SECRET, {
    algorithm: "HS256",
  });

  const unlinkUserRequest = {
    method: "POST",
    body: signedPayload,
    headers: {
      Authorization: "Bearer " + clientAccessTokenResponse.access_token,
      "Content-Type": "jwt",
    },
  };

  const unlinkUserResponse = await fetch(
    "https://open-access.spotify.com/api/v1/unlink-user",
    unlinkUserRequest
  );

  switch (unlinkUserResponse.status) {
    case 404:
      return res.status(404).json({ error: "User is not linked" });
    case 403:
      return res.status(403).json({ error: "Client unauthorized" });
    case 400:
      return res.status(400).json({ error: "Malformed request" });
    case 200:
      return res.sendStatus(204);
    default:
      res.status(500).json({ error: "Unexpected response from Spotify" });
  }
});

api.get("/user-spotify-entitlements", authenticated, async (req, res) => {
  const clientAccessTokenResponse = await requestClientAccessToken(
    "soa-manage-entitlements"
  );

  const partnerUserIdHex = Buffer.from(req.userId, "base64").toString("hex");

  const payload = {
    partner_id: PARTNER_ID,
    partner_user_id: partnerUserIdHex,
  };

  const signedPayload = jwt.sign(payload, CLIENT_SECRET, {
    algorithm: "HS256",
  });

  const entitlementRequest = {
    method: "POST",
    body: signedPayload,
    headers: {
      Authorization: "Bearer " + clientAccessTokenResponse.access_token,
      "Content-Type": "jwt",
    },
  };

  const entitlementResponse = await fetch(
    "https://open-access.spotify.com/api/v1/get-entitlements",
    entitlementRequest
  );

  switch (entitlementResponse.status) {
    case 404:
      return res.status(404).json({ error: "User is not linked" });
    case 403:
      return res.status(403).json({ error: "Client unauthorized" });
    case 400:
      return res.status(400).json({ error: "Malformed request" });
    case 200: {
      const responseData = await entitlementResponse.json();
      return res
        .cookie(
          "entitlements",
          JSON.stringify(responseData.entitlements),
          TEN_YEAR_COOKIE
        )
        .json({ entitlements: responseData.entitlements });
    }
    default:
      res.status(500).json({ error: "Unexpected response from Spotify" });
  }
});

api.post("/user-spotify-add-entitlements", authenticated, async (req, res) => {
  const clientAccessTokenResponse = await requestClientAccessToken(
    "soa-manage-entitlements"
  );

  const partnerUserIdHex = Buffer.from(req.userId, "base64").toString("hex");

  const payload = {
    partner_id: PARTNER_ID,
    partner_user_id: partnerUserIdHex,
    entitlements: req.body.entitlements,
  };

  const signedPayload = jwt.sign(payload, CLIENT_SECRET, {
    algorithm: "HS256",
  });

  const entitlementRequest = {
    method: "POST",
    body: signedPayload,
    headers: {
      Authorization: "Bearer " + clientAccessTokenResponse.access_token,
      "Content-Type": "jwt",
    },
  };

  const entitlementResponse = await fetch(
    "https://open-access.spotify.com/api/v1/add-entitlements",
    entitlementRequest
  );

  switch (entitlementResponse.status) {
    case 404:
      return res.status(404).json({ error: "User is not linked" });
    case 403:
      return res.status(403).json({ error: "Client unauthorized" });
    case 400:
      return res.status(400).json({ error: "Malformed request" });
    case 200: {
      const savedCookies = req.cookies["entitlements"];
      const newEntitlements = Array.from(
        new Set([
          ...(savedCookies ? JSON.parse(savedCookies) : []),
          ...req.body.entitlements,
        ])
      );
      return res
        .cookie(
          "entitlements",
          JSON.stringify(newEntitlements),
          TEN_YEAR_COOKIE
        )
        .sendStatus(204);
    }
    default:
      res.status(500).json({ error: "Unexpected response from Spotify" });
  }
});

api.post(
  "/user-spotify-replace-entitlements",
  authenticated,
  async (req, res) => {
    const clientAccessTokenResponse = await requestClientAccessToken(
      "soa-manage-entitlements"
    );

    const partnerUserIdHex = Buffer.from(req.userId, "base64").toString("hex");

    const payload = {
      partner_id: PARTNER_ID,
      partner_user_id: partnerUserIdHex,
      entitlements: req.body.entitlements,
    };

    const signedPayload = jwt.sign(payload, CLIENT_SECRET, {
      algorithm: "HS256",
    });

    const entitlementRequest = {
      method: "POST",
      body: signedPayload,
      headers: {
        Authorization: "Bearer " + clientAccessTokenResponse.access_token,
        "Content-Type": "jwt",
      },
    };

    const entitlementResponse = await fetch(
      "https://open-access.spotify.com/api/v1/replace-entitlements",
      entitlementRequest
    );

    switch (entitlementResponse.status) {
      case 404:
        return res.status(404).json({ error: "User is not linked" });
      case 403:
        return res.status(403).json({ error: "Client unauthorized" });
      case 400:
        return res.status(400).json({ error: "Malformed request" });
      case 200:
        return res
          .cookie(
            "entitlements",
            JSON.stringify(req.body.entitlements),
            TEN_YEAR_COOKIE
          )
          .sendStatus(204);
      default:
        res.status(500).json({ error: "Unexpected response from Spotify" });
    }
  }
);

api.post(
  "/user-spotify-delete-entitlements",
  authenticated,
  async (req, res) => {
    const clientAccessTokenResponse = await requestClientAccessToken(
      "soa-manage-entitlements"
    );

    const partnerUserIdHex = Buffer.from(req.userId, "base64").toString("hex");

    const payload = {
      partner_id: PARTNER_ID,
      partner_user_id: partnerUserIdHex,
      entitlements: req.body.entitlements,
    };

    const signedPayload = jwt.sign(payload, CLIENT_SECRET, {
      algorithm: "HS256",
    });

    const entitlementRequest = {
      method: "POST",
      body: signedPayload,
      headers: {
        Authorization: "Bearer " + clientAccessTokenResponse.access_token,
        "Content-Type": "jwt",
      },
    };

    const entitlementResponse = await fetch(
      "https://open-access.spotify.com/api/v1/delete-entitlements",
      entitlementRequest
    );

    switch (entitlementResponse.status) {
      case 404:
        return res.status(404).json({ error: "User is not linked" });
      case 403:
        return res.status(403).json({ error: "Client unauthorized" });
      case 400:
        return res.status(400).json({ error: "Malformed request" });
      case 200: {
        const savedEntitlements = req.cookies["entitlements"];
        const newEntitlements = savedEntitlements
          ? JSON.parse(savedEntitlements).filter(
              (s: string) => !req.body.entitlements.includes(s)
            )
          : [];
        return res
          .cookie(
            "entitlements",
            JSON.stringify(newEntitlements),
            TEN_YEAR_COOKIE
          )
          .sendStatus(204);
      }
      default:
        res.status(500).json({ error: "Unexpected response from Spotify" });
    }
  }
);

api.post("/update-subscription", authenticated, (req, res) => {
  res
    .cookie(
      "entitlements",
      JSON.stringify(req.body.entitlements),
      TEN_YEAR_COOKIE
    )
    .sendStatus(204);
});

api.get("/_ping", (_req, res) => res.status(204).send());

export { api };
