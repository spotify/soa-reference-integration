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

const Cookies = window.Cookies;

const applyToAll = (nodeList, cb) => Array.from(nodeList).forEach(cb);

const setSwitchStatus = () => {
  const authenticated = Boolean(Cookies.get("is_authenticated"));
  const buttons = document.querySelectorAll(".auth-status-button");

  const myAccountButton = document.getElementById("my-account-button");
  const buttonLinks = document.querySelectorAll(".auth-status-link");
  const displayIfNotAuthenticated = document.querySelectorAll(
    ".display-if-not-authenticated"
  );

  if (authenticated) {
    myAccountButton.style.display = "show";

    applyToAll(buttonLinks, (buttonLink) =>
      buttonLink.setAttribute("href", "/api/logout")
    );
    applyToAll(buttons, (button) => {
      button.textContent = "Logout";
    });

    applyToAll(displayIfNotAuthenticated, (node) =>
      node.classList.remove("display")
    );
  } else {
    applyToAll(buttonLinks, (buttonLink) => {
      buttonLink.setAttribute("href", "/login.html");
    }); // login will redirect to a html page using firebase UI to login
    applyToAll(buttons, (button) => (button.textContent = "Login"));
    applyToAll(displayIfNotAuthenticated, (node) =>
      node.classList.add("display")
    );
    myAccountButton.style.display = "none";
  }
};

setSwitchStatus();
