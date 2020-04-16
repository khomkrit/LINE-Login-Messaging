const app = require('express')()
const path = require('path');
const qs = require('qs')
const axios = require('axios')
const urlencode = require('urlencode')
const cookieSession = require('cookie-session')
const logInfo = require('debug')('app:info')
const logDebug = require('debug')('app:debug')
const logError = require('debug')('app:error')

app.set('trust proxy', 1)
app.use(cookieSession({
  name: 'session',
  keys: ['123456', '123456'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}))

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/line/auth_callback', async (req, res) => {
  logDebug('code = %s, state = %s', req.query.code, req.query.state)
  logDebug('body = %O', req.body)

  logInfo('verifying state %s', req.session.lineAuthState)
  if (req.query.state !== req.session.lineAuthState) {
    logError('verify state - FAIL')
    return res.status(400).send('state error')
  }

  logInfo('verify state - OK')

  let loginData

  try {
    const data = {
        grant_type:'authorization_code',
        code: `${req.query.code}`,
        redirect_uri: `${process.env.REDIRECT_URI}`,
        client_id: `${process.env.CLIENT_ID}`,
        client_secret:`${process.env.CLIENT_SECRET}`
    }

    logInfo('verifing code')
    let response = await axios({
        method: 'post',
        url: 'https://api.line.me/oauth2/v2.1/token',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        },
        data: qs.stringify(data)
    })
  
    logInfo('verifing - OK, received access_token')
    logDebug('response.data = %O', response.data)

    loginData = response.data

    logInfo(`getting user's profile, using access_token`)
    logDebug('acces_token = %s', loginData.access_token)
    response = await axios({
      method: 'get',
      url: 'https://api.line.me/v2/profile',
      headers: {
          'Authorization': `Bearer ${loginData.access_token}`
      }
    })

    logInfo(`get user's profile - OK`)
    logDebug('response.data = %O', response.data)

    loginData.userId = response.data.userId
    loginData.displayName = response.data.displayName
    loginData.pictureUrl = response.data.pictureUrl
    loginData.statusMessage = response.data.statusMessage

    logInfo('getting friendship status')
    response = await axios({
      method: 'get',
      url: 'https://api.line.me/friendship/v1/status',
      headers: {
        'Authorization': `Bearer ${loginData.access_token}`
      }
    })
    
    if (response.data.friendFlag === true) {
      logInfo('friendFlag == true, sending a Hello World message')
      
      const payloadMessage = {
        to: loginData.userId,
        messages: [
            {
                type: 'text',
                text: 'Hello World! ' + new Date().toDateString()
            }
        ]
      }

      logInfo('sending Hello World! message')
      logDebug('payloadMessage = %O', payloadMessage)
      response = await axios({
          method: 'post',
          url: 'https://api.line.me/v2/bot/message/push',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
          },
          data: payloadMessage
      })

      logInfo('send Hello World! message - OK')
      logDebug('response %O', response)

    }

    res.status(200).render('index', { 
      data: loginData, 
      client_id: process.env.CLIENT_ID,
      redirect_uri: urlencode(process.env.REDIRECT_URI),
      state: req.session.lineAuthState
    })
  } catch (error) {
    logError('error %O', error)
    res.status(400).send('something error')
  }
})

app.get('/', (req, res) => {
  logInfo('generating login state')
  req.session.lineAuthState = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10);
  logDebug('login state = %s', req.session.lineAuthState)

  res.status(200).render('index', { 
    data: undefined, 
    client_id: process.env.CLIENT_ID,
    redirect_uri: urlencode(process.env.REDIRECT_URI),
    state: req.session.lineAuthState
  })
})

app.listen(3000)
