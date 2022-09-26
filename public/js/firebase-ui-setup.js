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

const getRedirectUrl = () => {
  const urlParams = new URLSearchParams(document.location.search);
  if (urlParams.get("redirect_to")?.startsWith("/api/entrypoint")) {
    return "/api/entrypoint";
  } else if (urlParams.get("redirect_to")?.startsWith("/my-account.html")) {
    return "/my-account.html";
  } else {
    return "/";
  }
};

const ui = new firebaseui.auth.AuthUI(firebase.auth());
ui.start("#firebaseui-auth-container", {
  callbacks: {
    signInSuccessWithAuthResult: (authResult, redirectUrl) => {
      fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: authResult.user.uid }),
      }).then(() => {
        window.location = getRedirectUrl();
      });
    },
  },
  signInOptions: [
    {
      provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
      requireDisplayName: false,
    },
  ],
  signInSuccessUrl: false,
});
