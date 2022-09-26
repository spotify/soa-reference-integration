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

import { NextFunction, Request, Response } from "express";
import { authenticated } from "../middleware";
import jwt from "jsonwebtoken";

const MOCK_USER_ID = "logged_in_user";
jest.mock("../config", () => ({}));

describe("middleware", () => {
  describe("authenticated", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    const nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
      jest.resetAllMocks();

      mockRequest = {
        cookies: {},
        originalUrl: "/api/entrypoint",
      };
      mockResponse = {};
      mockResponse.status = jest.fn().mockReturnValue(mockResponse);
      mockResponse.location = jest.fn().mockReturnValue(mockResponse);
      mockResponse.send = jest.fn();

      jest.spyOn(jwt, "verify").mockImplementationOnce(() => MOCK_USER_ID);
    });

    test("without cookie", async () => {
      authenticated(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      expect(mockResponse.status).toBeCalledWith(302);
      expect(mockResponse.location).toBeCalledWith(
        "/login.html?redirect_to=/api/entrypoint"
      );
    });

    test("with cookie", async () => {
      mockRequest.cookies.lunar_industries__user = MOCK_USER_ID;
      authenticated(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toBeCalledTimes(1);
    });
  });
});
