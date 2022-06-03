[![License](https://img.shields.io/badge/LICENSE-Apache2.0-ff69b4.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
![lifecycle: beta](https://img.shields.io/badge/lifecycle-beta-509bf5.svg)

# Spotify Open Access Reference Integration

Spotify Open Access (SOA) allows partners with existing subscription or membership systems to publish podcast content on Spotify, and restrict access to that content based on existing subscription enforcement.

SOA exposes an API that partners must integrate with. This repository serves as a reference for how this integration can look. You can read more about SOA and see details about the endpoints in the [official documentation](https://developer.spotify.com/documentation/open-access/overview/).

## Live Example

To experience the linking process with this reference integration, you can link your Spotify account with the demo partner "Lunar Industries" [here](https://lunar-industries.spotify.com/).

### Partner Configuration

To add your own Spotify Open Access partner information, create a copy of the [`.env.template`](./.env.template) file, rename it to `.env`, and add your partner configuration.

```
# Your partner ID provided by Spotify
PARTNER_ID=

# Your client ID provided by Spotify
CLIENT_ID=

# Your client secret provided by Spotify
CLIENT_SECRET=

# The callback URL where the user is redirected upon successful Spotify Authorization
CALLBACK_URL=

# A private encryption secret used to encode cookies in this example application, not shared with Spotify
LOCAL_SECRET=
```

### Authentication

We used Firebase as an off-the-shelf solution since the purpose of this example app is not authentication itself. If you wish to use Firebase as well, you can read more [here](https://firebase.google.com/docs/web/setup#create-firebase-project-and-app) about creating a project, and then add your config object in [public/js/firebase.js](public/js/firebase.js). Otherwise, you will have to tinker with the project do add your own means of authentication, as it's a key component of the Spotify Open Access flow.

### Running

After you cloned the repo and added the necessary configuration, run the following command to install all of the dependencies, and set up the pre-commit hooks.

```
yarn install
```

Once dependencies are installed, you can run

```
yarn build && yarn start
```

or, for development mode, which will restart the service upon detected changes, run

```
yarn dev
```

## Guidelines

The purpose of this application is to provide example usages of the SOA API and serve as a guide when integrating with SOA. It is not intended to provide the Spotify partners with a full-fledged application. We are assuming that you will or have implemented authentication and other vital elements, in the best suitable way for you.

## License

Copyright 2022 Spotify, Inc.

Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0