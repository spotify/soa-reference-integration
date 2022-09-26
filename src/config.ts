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

import dotenv from "dotenv";

dotenv.config();

/*
These environment variables are required when running the application
An explanation of the values can be found in .env.template
*/
const REQUIRED_ENVIRONMENT_VARIABLES = [
  "PARTNER_ID",
  "CLIENT_ID",
  "CLIENT_SECRET",
  "CALLBACK_URL",
  "LOCAL_SECRET",
];

const missingEnvironmentVariables = REQUIRED_ENVIRONMENT_VARIABLES.filter(
  (key) => !process.env[key]
);
if (missingEnvironmentVariables.length > 0) {
  throw new Error(
    `The following environment variables necessary for running the app are missing: ${missingEnvironmentVariables.join(
      ", "
    )}`
  );
}

// Note that the nginx config in the docker base image assumes the app listens on 3000
export const PORT = process.env.PORT || 3000;
export const PARTNER_ID = process.env.PARTNER_ID as string;
export const CLIENT_ID = process.env.CLIENT_ID as string;
export const CLIENT_SECRET = process.env.CLIENT_SECRET as string;
export const CALLBACK_URL = process.env.CALLBACK_URL as string;
export const LOCAL_SECRET = process.env.LOCAL_SECRET as string;
