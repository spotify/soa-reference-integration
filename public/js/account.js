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

class AccountController {
  constructor(subscriptionsRoot, spotifyLinkRoot, model) {
    this.model = model;
    this.view = new AccountView(
      subscriptionsRoot,
      spotifyLinkRoot,
      model,
      this.handleTierCtaClicked.bind(this),
      this.handleFullUnsubscribeClick.bind(this),
      this.handleSpotifyConnectionClicked.bind(this)
    );
    this.handleTierCtaClicked.bind(this);
    this.loadSubscriptionStatus().then(() => this.view.render());
  }

  async loadSubscriptionStatus() {
    const res = await fetch("/api/user-spotify-entitlements");
    if (res.status !== 200) {
      this.model.isLinked = false;
      this.model.syncSubscriptions();
    } else {
      const data = await res.json();
      this.model.isLinked = true;
      this.model.setSubscriptions(data.entitlements);
    }
  }

  async handleTierCtaClicked(tier) {
    const isSubscribed = this.model.isSubscribedTo(tier);

    if (isSubscribed) {
      await this.unsubscribeFromShow(tier);
    } else {
      await this.subscribeToShow(tier);
    }
    this.view.render();
  }

  async handleFullUnsubscribeClick() {
    await this.unsubscribeFromAllShows();
    this.view.render();
  }

  async handleSpotifyConnectionClicked() {
    const isLinked = this.model.isLinked;

    if (isLinked) {
      await this.unlinkFromSpotify();
      this.view.render();
    } else {
      this.connectToSpotify();
    }
  }

  async subscribeToShow(show) {
    if (this.model.isLinked) {
      await fetch("/api/user-spotify-add-entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlements: [show] }),
      });
    } else {
      await fetch("/api/update-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entitlements: Array.from(
            new Set([...this.model.subscriptions, show])
          ),
        }),
      });
    }
    this.model.syncSubscriptions();
  }

  async unsubscribeFromShow(show) {
    /*
    The endpoint delete-entitlements requires a list of the entitlements(s) that should be removed from the user.
    For detailed information: https://developer.spotify.com/documentation/open-access/reference/#/operations/delete-entitlements
    */
    if (this.model.isLinked) {
      await fetch("/api/user-spotify-delete-entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlements: [show] }),
      });
    } else {
      await fetch("/api/update-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entitlements: this.model.subscriptions.filter((s) => s !== show),
        }),
      });
    }
    this.model.syncSubscriptions();
  }

  async unsubscribeFromAllShows() {
    /*
    When calling the endpoint replace-entitlements with an empty list, all the user's entitlements will be removed.
    For detailed information: https://developer.spotify.com/documentation/open-access/reference/#/operations/replace-entitlements
    */
    if (this.model.isLinked) {
      await fetch("/api/user-spotify-replace-entitlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlements: [] }),
      });
    } else {
      await fetch("/api/update-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entitlements: [],
        }),
      });
    }
    this.model.syncSubscriptions();
  }

  connectToSpotify() {
    window.location.replace("/api/entrypoint");
  }

  unlinkFromSpotify() {
    return fetch("/api/user-spotify-unlink", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }).then(() => (this.model.isLinked = false));
  }
}

class AccountModel {
  constructor() {
    this.isLinked = false;
    this.subscriptions = [];
  }

  setSubscriptions(subscriptions) {
    this.subscriptions = subscriptions;
  }

  syncSubscriptions() {
    const savedEntitlements = Cookies.get("entitlements");
    this.subscriptions = savedEntitlements ? JSON.parse(savedEntitlements) : [];
  }

  isSubscribedTo(tier) {
    return this.subscriptions.includes(tier);
  }
}

class AccountView {
  constructor(
    subscriptionsRoot,
    spotifyLinkRoot,
    model,
    onTierCtaClicked,
    onFullUnsubscribeClick,
    onSpotifyConnectionClicked
  ) {
    this.subscriptionsRoot = subscriptionsRoot;
    this.spotifyLinkRoot = spotifyLinkRoot;
    this.model = model;
    this.onTierCtaClicked = onTierCtaClicked;
    this.onFullUnsubscribeClick = onFullUnsubscribeClick;
    this.onSpotifyConnectionClicked = onSpotifyConnectionClicked;
  }

  render() {
    this.renderSubscriptions();
    this.renderSpotifyLink();
  }

  renderSpotifyLink() {
    this.spotifyLinkRoot.innerText = "";
    const isLinked = this.model.isLinked;

    const unlinkInfo = document.createElement("p");
    if (isLinked) {
      unlinkInfo.textContent =
        "Your account is already connected to Spotify. To unlink your account click the button below, this will remove your access to your paid podcasts on the Spotify app.";
    } else {
      unlinkInfo.textContent =
        "By linking your account to Spotify, you'll get access to any of your paid podcasts on the Spotify app.";
    }
    this.spotifyLinkRoot.appendChild(unlinkInfo);

    const unlinkButton = document.createElement("button");
    unlinkButton.classList.add("spotify-link");
    unlinkButton.addEventListener("click", this.onSpotifyConnectionClicked);
    this.spotifyLinkRoot.appendChild(unlinkButton);

    const spotifyLogo = document.createElement("img");
    spotifyLogo.src = "/assets/img/Spotify_Icon_RGB_White.png";
    spotifyLogo.width = 20;
    spotifyLogo.height = 20;
    unlinkButton.appendChild(spotifyLogo);

    const buttonText = document.createElement("span");
    if (isLinked) {
      buttonText.textContent = "Unlink from Spotify";
    } else {
      buttonText.textContent = "Connect to Spotify";
    }
    unlinkButton.appendChild(buttonText);
  }

  renderSubscriptions() {
    const premiumTierNode = this.renderTier(
      "Living on the Moon",
      "Access to all episodes from Living on the Moon.",
      3,
      "premium-tier-subscribers",
      "https://open.spotify.com/show/0EwATaqqn7Yb0LX6O9XiqI",
      "/assets/img/living-on-the-moon-artwork.jpg",
      "Podcast artwork of the show Living on the Moon"
    );
    const bonusTierNode = this.renderTier(
      "The Dark Side",
      "Includes all bonus content from The Dark Side.",
      2,
      "bonus-tier-subscribers",
      "https://open.spotify.com/show/0hFhphwy0gCuuFkOGF4BRu",
      "/assets/img/the-dark-side-artwork.jpg",
      "Podcast artwork of the show called The Dark Side"
    );

    const noSubscriptionsIndicator = this.renderNoSubscriptionsIndicator();
    const fullUnsubscribeButton = this.renderFullUnsubscribeButton();

    this.subscriptionsRoot.innerText = "";

    this.subscriptionsRoot.appendChild(noSubscriptionsIndicator);
    this.subscriptionsRoot.appendChild(premiumTierNode);
    this.subscriptionsRoot.appendChild(bonusTierNode);
    this.subscriptionsRoot.appendChild(fullUnsubscribeButton);
  }

  renderTier(title, description, price, tier, showUrl, coverUrl, coverAlt) {
    const isSubscribed = this.model.isSubscribedTo(tier);

    const container = document.createElement("div");
    container.classList.add("subscription-tier");
    if (isSubscribed) {
      container.classList.add("subscribed");
    }

    const showInfo = document.createElement("div");
    showInfo.classList.add("show-info");
    container.appendChild(showInfo);

    const subscribedIndicator = document.createElement("div");
    subscribedIndicator.classList.add("subscribed-indicator");
    subscribedIndicator.textContent = "Subscribed";
    if (isSubscribed) {
      subscribedIndicator.classList.add("show");
    }
    showInfo.appendChild(subscribedIndicator);

    const tierTitle = document.createElement("h3");
    tierTitle.textContent = title;
    showInfo.appendChild(tierTitle);

    const tierDescription = document.createElement("p");
    tierDescription.textContent = description;
    tierDescription.classList.add("subscription-description");
    showInfo.appendChild(tierDescription);

    const tierPrice = document.createElement("p");
    let tierPriceTextContent = `\$${price} per month.`;
    if (isSubscribed) {
      const now = new Date();
      // prettier-ignore
      const monthToPresentation = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const renewalDateString = ` Renews ${now.getDate()} ${
        monthToPresentation[now.getMonth()]
      } ${now.getFullYear() + 1}.`;
      tierPriceTextContent += renewalDateString;
    }
    tierPrice.textContent = tierPriceTextContent;
    tierPrice.classList.add("subscription-price");
    showInfo.appendChild(tierPrice);

    const tierCtaButton = document.createElement("button");
    tierCtaButton.textContent = isSubscribed ? "Unsubscribe" : "Subscribe";
    tierCtaButton.classList.add("subscription-button");
    tierCtaButton.addEventListener("click", () => this.onTierCtaClicked(tier));
    showInfo.appendChild(tierCtaButton);

    const showCover = document.createElement("div");
    showCover.classList.add("show-cover");
    container.appendChild(showCover);

    const showLink = document.createElement("a");
    showLink.href = showUrl;
    showLink.target = "_blank";
    showCover.appendChild(showLink);

    const showCoverImage = document.createElement("img");
    showCoverImage.src = coverUrl;
    showCoverImage.alt = coverAlt;
    showLink.appendChild(showCoverImage);

    return container;
  }

  renderNoSubscriptionsIndicator() {
    const noSubscriptionsIndicator = document.createElement("p");
    noSubscriptionsIndicator.textContent = "You have no active subscriptions";
    noSubscriptionsIndicator.id = "no-subscriptions";
    if (this.model.subscriptions.length === 0) {
      noSubscriptionsIndicator.classList.add("show");
    }

    return noSubscriptionsIndicator;
  }

  renderFullUnsubscribeButton() {
    const fullUnsubscribeButton = document.createElement("button");
    fullUnsubscribeButton.textContent = "Unsubscribe from all podcasts";
    fullUnsubscribeButton.classList.add("subscription-button");
    fullUnsubscribeButton.id = "full-unsubscribe-button";
    if (this.model.subscriptions.length === 2) {
      fullUnsubscribeButton.classList.add("show");
    }
    fullUnsubscribeButton.addEventListener(
      "click",
      this.onFullUnsubscribeClick
    );

    return fullUnsubscribeButton;
  }
}

const redirectIfUnauthenticated = () => {
  const authenticated = Boolean(Cookies.get("is_authenticated"));
  if (!authenticated) {
    window.location.href = "/login.html?redirect_to=/my-account.html";
  }
};

const setUpPage = () => {
  const subscriptionsRoot = document.querySelector("#subscription-tiers");
  const spotifyLinkRoot = document.querySelector("#spotify-link");
  const model = new AccountModel();
  new AccountController(subscriptionsRoot, spotifyLinkRoot, model);
};

redirectIfUnauthenticated();
setUpPage();
