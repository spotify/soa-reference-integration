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

// eslint-disable-next-line no-undef
module.exports = {
  server: {
    command: 'yarn build && yarn start',
    port: 3000,
    launchTimeout: 120000,
    debug: true,
  },
  launch: {
    headless: true,
    // locally we use chrome, in Tingle we use the chromium browser
    // eslint-disable-next-line no-undef
    executablePath: process.env.CI ? '/usr/bin/chromium-browser' : undefined,
  },
};
