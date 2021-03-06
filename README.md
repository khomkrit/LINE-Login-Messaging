# LINE Login and Messaging

Before running this project

## Setup LINE Developer Account and Channels

1. [Create a development account](https://developers.line.biz/en/)
2. [Create a Provider](https://developers.line.biz/console/)
3. Pick a provider
4. Create a LINE Login channel, fillout Basic Settings and **Callback URL** in the LINE Login section, it's the URL to which the user is redirected after logging in. ([Configuring your channel](https://developers.line.biz/en/docs/line-login/integrate-line-login/#configuring-your-channel))

5. Create a Messaging API channel and issue a Channel access token. We will use this channel access token to call the Messaging API.

## Configure `.env` file

There are 4 keys to configure

- `CLIENT_ID` - from 4. -> Basic Settings section -> **Channel ID**
- `CLIENT_SECRET` - from 4. -> Basic Settings section -> **Channel secret**
- `REDIRECT_URI` - from 4. -> LINE Login section -> **Callback URL**
- `CHANNEL_ACCESS_TOKEN` - from 5 -> Messaging API -> **Channel Access Token**

## Run

``` sh
npm install
npm start
```

You can configure debug level in `package.json`, default are `app:info` and `app:error`

- `app:error`
- `app:info`
- `app:debug`

## Making an Authorization Request

Handle user login at the route `/`

we will create a simple login link using 2 configurable params in our `.env` including 1 parameter generated by yourself.

1. `client_id` - it's a channel ID. Unique identifier for your channel issued by LINE.
2. `redirect_uri` - it's a callback URL. URL that users are redirected to after authentication and authorization. Must match one of the the callback URLs registered for your channel in the [console](https://developers.line.biz/console/)
3. `state` - A unique alphanumeric string used to prevent [cross-site request forgery](https://wikipedia.org/wiki/Cross-site_request_forgery). This value should be randomly generated by your application. Cannot be a URL-encoded string. 

So, we need to begin with generating a `state` value and store it in session before sending it to `views/index` 

``` js
app.get('/', (req, res) => {
  req.session.lineAuthState = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10);
  res.status(200).render('index', {
    data: undefined,
    client_id: process.env.CLIENT_ID,
    redirect_uri: urlencode(process.env.REDIRECT_URI),
    state: req.session.lineAuthState
  })
})
```

the login link will be rendered in `views/index.ejs`

``` html
<a href="https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=<%= client_id %>&redirect_uri=<%= redirect_uri %>&state=<%= state %>&scope=profile%20openid&bot_prompt=aggressive">Login</a>
```

We also added `bot_prompt` in the query parameters above and set its value to `aggressive` [Read more](https://developers.line.biz/en/docs/line-login/link-a-bot/#displaying-the-option-to-add-your-line-official-account-as-a-friend)

When user clicked the login link, the login process begins and in the end, the `callback_uri` will be hooked. in this demo, it's `/line/auth_callback`

REF: [Making an authorization request](https://developers.line.biz/en/docs/line-login/integrate-line-login/#making-an-authorization-request)

## Handle Callback

Call back will be performed at `/line/auth_callback` route. Begin with verifying the `state`'s value.

``` js
if (req.query.state !== req.session.lineAuthState) {
  return res.status(400).send('state error')
}
```

## Get Access Token

Use `code` obtained from the callback request to get `access_token`

``` js
const data = {
    grant_type:'authorization_code',
    code: `${req.query.code}`,
    redirect_uri: `${process.env.REDIRECT_URI}`,
    client_id: `${process.env.CLIENT_ID}`,
    client_secret:`${process.env.CLIENT_SECRET}`
}

let response = await axios({
    method: 'post',
    url: 'https://api.line.me/oauth2/v2.1/token',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    },
    data: qs.stringify(data)
})
```

REF: [Get Access Token](https://developers.line.biz/en/docs/line-login/integrate-line-login/#get-access-token)

## Get User Profile

use `access_token` to get user's profile

``` js
response = await axios({
  method: 'get',
  url: 'https://api.line.me/v2/profile',
  headers: {
      'Authorization': `Bearer ${loginData.access_token}`
  }
})
```

REF: [Getting user profiles](https://developers.line.biz/en/docs/social-api/getting-user-profiles/#before-you-begin)

## Check Friendship Status

use `access_token` to get friendship status before sending a greeing message.

``` js
response = await axios({
  method: 'get',
  url: 'https://api.line.me/friendship/v1/status',
  headers: {
    'Authorization': `Bearer ${loginData.access_token}`
  }
})
```

## Send a Greeting Mesage

Since the requested user is your friend then send a greeting message.

``` js
const payloadMessage = {
  to: loginData.userId,
  messages: [
      {
          type: 'text',
          text: 'Hello World! ' + new Date().toDateString()
      }
  ]
}
response = await axios({
  method: 'post',
  url: 'https://api.line.me/v2/bot/message/push',
  headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
  },
  data: payloadMessage
})
```

REF: [Push Message](https://developers.line.biz/en/docs/social-api/getting-user-profiles/#before-you-begin)

## Return to Home Screen

Send user back to `/` and show some user info.

``` js
res.status(200).render('index', {
  data: loginData,
  client_id: process.env.CLIENT_ID,
  redirect_uri: urlencode(process.env.REDIRECT_URI),
  state: req.session.lineAuthState
})
```
