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

import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { LOCAL_SECRET } from "./config";

export const authenticated: RequestHandler = (req, res, next) => {
  /*
  The naive approach we use to validate the authentication state of a user is to inspect the cookie set in /login
  This is not intended to be reproduced in your actual production implementation.
  See documentation about Spotify authorization: https://developer.spotify.com/documentation/general/guides/authorization/code-flow/
  */
  const userId = req.cookies["lunar_industries__user"];
  const authenticated = Boolean(userId);

  if (authenticated) {
    try {
      const decodedUserId = jwt.verify(userId, LOCAL_SECRET).toString();
      req.userId = decodedUserId;
      return next();
    } catch {
      // eslint-disable-next-line no-empty
    }
  }

  return res
    .status(302)
    .location("/login.html?redirect_to=" + req.originalUrl)
    .send();
};
