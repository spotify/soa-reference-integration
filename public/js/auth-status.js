const Cookies = window.Cookies;

const setSwitchStatus = () => {
  const authenticated = Boolean(Cookies.get("is_authenticated"));

  const button = document.getElementById("auth-status-button");
  const buttonLink = document.getElementById("auth-status-link");
  const soaButtons = document.getElementById("soa-buttons");

  if (authenticated) {
    buttonLink.setAttribute("href", "/api/logout"); // logout will clear the cookie and redirect to the start page
    button.classList.add("danger");
    button.textContent = "Logout";
    soaButtons.setAttribute("class", "show");
  } else {
    buttonLink.setAttribute("href", "/login.html"); // login will redirect to a html page using firebase UI to login
    button.textContent = "Login / Subscribe";
  }
};

setSwitchStatus();
