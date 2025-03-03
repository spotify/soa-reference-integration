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

const updateCtaButtonsToReflectLinkingState = (buttons) => {
  fetch("/api/user-spotify-entitlements").then((res) => {
    if (res.status === 200) {
      buttons.forEach((node) => (node.textContent = "Listen Now"));
    } else {
      buttons.forEach((node) => (node.textContent = "Subscribe"));
    }
  });
};

const setUpEventListeners = () => {
  const authenticated = Boolean(Cookies.get("is_authenticated"));

  const landingPageNotice = document.getElementById("landing-page-notice");
  const subscribeCtaButtons = document.querySelectorAll(".cta");
  const soaConnect = document.getElementById("soa-connect");

  subscribeCtaButtons.forEach((button) => {
    button.textContent = "Subscribe";
  });

  if (authenticated) {
    landingPageNotice.style.display = "none";
    updateCtaButtonsToReflectLinkingState(subscribeCtaButtons);
    soaConnect.setAttribute("class", "show");
  }
};

setUpEventListeners();
