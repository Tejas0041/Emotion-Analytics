if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const app = express()
const methodOverride = require('method-override')
const mongoose = require('mongoose')
const path = require('path')
const ejsMate = require('ejs-mate')
const cookieParser = require('cookie-parser')
// JWT middleware removed - using Passport.js for authentication

// Performance optimizations
app.set('trust proxy', 1)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Add cache control headers
// Middleware setup
app.use(cookieParser())
app.use((req, res, next) => {
  // Don't cache any pages that require authentication
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Expires', '0')
  next()
})

// Remove authentication middleware from here - will be added after Passport setup

// Remove the duplicate logout route here since we have one later
const session = require('express-session')
const flash = require('connect-flash')
const User = require('./models/userschema.js')
const Emotion = require('./models/emotionschema.js')
const { storage } = require('./cloudinary/cloudinary.js')
const multer = require('multer')
const upload = multer({ storage: storage })
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoDBStore = require('connect-mongo')
const sgMail = require('@sendgrid/mail')
const sgMailApi = process.env.SENDGRID_API

const secret = process.env.SECRET || 'thisshouldbeabettersecret'
// const dbUrl= 'mongodb://localhost:27017/emotion-analytics';
const dbUrl = process.env.DB_URL

const { isLoggedIn, isAdmin, isVerified, isActive } = require('./middleware.js')

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs')

app.use(methodOverride('_method'))

app.set('views', path.join(__dirname, 'views'))
// Static files with caching
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true
  })
)

sgMail.setApiKey(sgMailApi)

// Optimized MongoDB connection
mongoose.connect(dbUrl, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})

const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error: '))
db.once('open', async () => {
  console.log('Database Connected')
  await seedAdminUser()
})

// Admin user seeding function
async function seedAdminUser () {
  try {
    // Check if admin user already exists
    let adminUser = await User.findOne({ username: 'admin' })

    if (!adminUser) {
      // Create new admin user
      const adminData = {
        fullname: 'System Administrator',
        username: 'admin',
        personalemail: 'admin@system.local',
        gsuite: 'admin@system.local',
        semester: 'N/A',
        mobilenumber: '0000000000',
        verified: true,
        active: true,
        emotion: 0,
        remark: 'ok'
      }

      adminUser = new User(adminData)
      await User.register(adminUser, 'admin')
      console.log('Admin user created successfully')
    } else {
      // Update existing admin user properties if needed
      adminUser.verified = true
      adminUser.active = true
      adminUser.remark = 'ok'
      await adminUser.save()
      console.log('Admin user verified and updated')
    }

    // Handle migration from old 'Admin' username
    const oldAdmin = await User.findOne({ username: 'Admin' })
    if (oldAdmin) {
      console.log('Found old Admin user, removing...')
      await User.findOneAndDelete({ username: 'Admin' })
      console.log('Old Admin user removed')
    }
  } catch (error) {
    console.error('Error seeding admin user:', error)
  }
}

const store = new MongoDBStore({
  mongoUrl: dbUrl,
  secret,
  touchAfter: 24 * 60 * 60 //time is in seconds
})

store.on('error', function (err) {
  console.log('Error!', err)
})

const sessionConfig = {
  store,
  name: 'emotionanalytics',
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // Set to true in production with HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax'
  }
}

app.use(session(sessionConfig))
app.use(flash())

app.use(passport.initialize())
app.use(passport.session())

passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

passport.use(new LocalStrategy(User.authenticate()))
var k = 0

function generateRandomString (length) {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const charactersLength = characters.length
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charactersLength)
    result += characters[randomIndex]
  }
  return result
}

// Define public paths that don't require authentication
const publicPaths = [
  '/login',
  '/logout',
  '/register',
  '/forgot-password',
  '/styles',
  '/scripts',
  '/model',
  '/health',
  '/admin/reset-password',
  '/otp-verification-page',
  '/change-password',
  '/update-password',
  '/resubmission',
  '/approval'
]

app.use((req, res, next) => {
  // Ensure proper session handling
  if (req.session && !req.user && req.session.passport) {
    // Clear stale passport session data
    delete req.session.passport
  }

  // Set flash messages and notification count
  res.locals.success = req.flash('success')
  res.locals.error = req.flash('error')
  res.locals.dot = k

  // Authentication middleware - now after Passport setup
  // For public paths, ensure currentUser is null
  if (publicPaths.some(path => req.path.startsWith(path))) {
    res.locals.currentUser = null
    return next()
  }

  // For protected paths, check authentication
  if (req.user && req.isAuthenticated && req.isAuthenticated()) {
    res.locals.currentUser = req.user
    next()
  } else {
    res.locals.currentUser = null
    res.redirect('/login')
  }
})

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.get('/', (req, res) => {
  try {
    // Check if user is properly authenticated
    if (req.user && req.isAuthenticated && req.isAuthenticated()) {
      res.redirect('/viewprofile')
    } else {
      // Clear any stale session data and redirect to login
      res.clearCookie('emotionanalytics', { path: '/' })
      res.clearCookie('connect.sid', { path: '/' })
      res.clearCookie('token', { path: '/' })
      res.redirect('/login')
    }
  } catch (error) {
    console.error('Root route error:', error)
    res.clearCookie('emotionanalytics', { path: '/' })
    res.redirect('/login')
  }
})

app.get('/home', isLoggedIn, isVerified, isActive, async (req, res) => {
  res.render('templates/home.ejs')
})

app.get('/homeadmin/:filter', isAdmin, async (req, res) => {
  const { filter } = req.params

  let query = {}
  if (filter === 'all') {
    query = { verified: true }
  } else if (filter === 'active') {
    query = { active: true, verified: true }
  } else if (filter === 'deactive') {
    query = { active: false, verified: true }
  }

  const users = await User.find(query)
    .select('fullname username personalemail semester active')
    .lean()
  res.render('templates/homeadmin.ejs', { users })
})

app.get(
  '/viewprofile/:id',
  isLoggedIn,
  isVerified,
  isActive,
  async (req, res) => {
    // const u= req.user;
    const { id } = req.params
    const u = await User.findById(id)
    res.render('templates/profile.ejs', { u })
  }
)

app.get('/viewprofile', isLoggedIn, isVerified, isActive, async (req, res) => {
  const u = req.user
  // const {id}= req.params;
  // const u= await User.findById(id);
  res.render('templates/profile.ejs', { u })
})

app.get('/login', (req, res) => {
  // Ensure no caching of login page
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  // Clear currentUser to ensure clean state
  res.locals.currentUser = null

  res.render('templates/login.ejs')
})

app.get('/login/admin', (req, res) => {
  res.render('templates/adminlogin.ejs')
})

app.post(
  '/login',
  passport.authenticate('local', {
    failureFlash: true,
    failureRedirect: '/login'
  }),
  isVerified,
  isActive,
  (req, res) => {
    req.flash('success', 'Welcome back!')
    console.log('Login successful for user:', req.user.username)
    res.redirect('/viewprofile')
  }
)

app.post(
  '/login/admin',
  passport.authenticate('local', {
    failureFlash: true,
    failureRedirect: '/login/admin'
  }),
  isAdmin,
  (req, res) => {
    req.flash('success', 'Welcome back, Admin!')
    console.log('Admin login successful for user:', req.user.username)
    res.redirect('/homeadmin/all')
  }
)

app.get('/logout', (req, res, next) => {
  console.log('Logout route called')

  // Aggressive cookie clearing - try multiple variations to ensure removal
  const cookiesToClear = ['emotionanalytics', 'connect.sid', 'token']

  cookiesToClear.forEach(cookieName => {
    // Clear with different path and option combinations
    res.clearCookie(cookieName)
    res.clearCookie(cookieName, { path: '/' })
    res.clearCookie(cookieName, { path: '/', domain: 'localhost' })
    res.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    })
    res.clearCookie(cookieName, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    })
  })

  // Clear currentUser immediately
  res.locals.currentUser = null

  try {
    // Try passport logout if available
    if (req.logout && typeof req.logout === 'function') {
      req.logout(function (err) {
        if (err) {
          console.error('Passport logout error:', err)
        }

        // Try to destroy session
        if (req.session && typeof req.session.destroy === 'function') {
          req.session.destroy(sessionErr => {
            if (sessionErr) {
              console.error('Session destruction error:', sessionErr)
            }
            console.log(
              'Session destroyed, all cookies cleared, redirecting to login'
            )
            // Add cache-busting parameter to prevent cached pages
            res.redirect('/login?logout=success&t=' + Date.now())
          })
        } else {
          console.log(
            'No session to destroy, all cookies cleared, redirecting to login'
          )
          res.redirect('/login?logout=success&t=' + Date.now())
        }
      })
    } else {
      // No passport logout available
      console.log(
        'No passport logout, clearing session and all cookies manually'
      )
      if (req.session) {
        req.session.destroy(err => {
          if (err) console.error('Manual session destruction error:', err)
          res.redirect('/login?logout=success&t=' + Date.now())
        })
      } else {
        res.redirect('/login?logout=success&t=' + Date.now())
      }
    }
  } catch (error) {
    console.error('Critical logout error:', error)
    res.redirect('/login?logout=error&t=' + Date.now())
  }
})

// Alternative logout route for emergencies
app.get('/force-logout', (req, res) => {
  try {
    // Force clear everything
    res.clearCookie('emotionanalytics')
    res.clearCookie('connect.sid') // Default session cookie name

    // Try to destroy session if it exists
    if (req.session) {
      req.session.destroy(() => {
        res.redirect('/login?msg=force-logout')
      })
    } else {
      res.redirect('/login?msg=force-logout')
    }
  } catch (error) {
    console.error('Force logout error:', error)
    res.redirect('/login?msg=error')
  }
})

//for admin
app.get('/approval-request', isAdmin, async (req, res) => {
  const users = await User.find({ verified: false, remark: '!ok' })
  if (users) {
    notification = 1
  } else notification = 0

  res.render('templates/approvalrequest.ejs', { users, notification })
})

app.get('/approval/:id', async (req, res) => {
  const { id } = req.params
  const u = await User.findById(id)
  if (u.verified === true && u.active === true) return res.redirect('/home')

  if (!u.active) {
    var message = 'Your account has been currently Deactivated by the Admin'
  }
  if (u.verified === false && u.remark === '!ok') {
    var message = 'Please wait until the Admin verify your details'
  }
  if (u.verified === false && u.remark != '!ok' && u.remark != 'ok') {
    return res.render('templates/resubmission.ejs', { u })
  }

  res.render('templates/approvalmessage.ejs', { message })
})

app.post('/approve-registration/:id', isAdmin, async (req, res) => {
  const id = req.params.id

  const user = await User.findById(id)

  user.verified = true
  user.remark = 'ok'
  k -= 1
  await user.save()
  res.redirect('/approval-request')
})

app.post('/decline-registration/:id', isAdmin, async (req, res) => {
  const { id } = req.params
  const user = await User.findById(id)
  const { remark } = req.body
  user.remark = remark
  user.save()
  // const user= await User.findByIdAndDelete(id);
  k -= 1
  res.redirect('/approval-request')
})

app.get('/register', (req, res) => {
  res.render('templates/register.ejs')
})

app.post('/register', upload.array('image'), async (req, res) => {
  try {
    const {
      fullname,
      username,
      personalemail,
      gsuite,
      semester,
      mobilenumber,
      password
    } = req.body

    var u_personalemail = 0
    var u_gsuite = 0
    var u_mobilenumber = 0
    u_personalemail = await User.find({ personalemail })
    u_gsuite = await User.find({ gsuite })
    u_mobilenumber = await User.find({ mobilenumber })

    if (u_personalemail != 0) {
      req.flash(
        'error',
        `An account with personal email ${personalemail} already exist`
      )
      return res.redirect('/register')
    }

    if (u_gsuite != 0) {
      req.flash('error', `An account with Gsuite ID ${gsuite} already exist`)
      return res.redirect('/register')
    }

    if (u_mobilenumber != 0) {
      req.flash(
        'error',
        `An account with Mobile number ${mobilenumber} already exist`
      )
      return res.redirect('/register')
    }

    const u = new User({
      fullname,
      username,
      personalemail,
      gsuite,
      semester,
      mobilenumber
    })

    u.image = req.files.map(f => ({ url: f.path, filename: f.filename }))
    u.emotion = 0
    const newUser = await User.register(u, password)
    k += 1
    res.redirect(`/approval/${newUser._id}`)
  } catch (e) {
    req.flash('error', e.message)
    res.redirect('/register')
  }
})

app.get(
  '/profile/edit/:id',
  isLoggedIn,
  isVerified,
  isActive,
  async (req, res) => {
    const { id } = req.params
    const u = await User.findById(id)

    res.render('templates/editprofile.ejs', { u })
  }
)

app.put(
  '/profile/edit/:id',
  isLoggedIn,
  isVerified,
  isActive,
  upload.array('image'),
  async (req, res) => {
    const { id } = req.params
    const u = req.body
    const user = await User.findById(id)
    user.fullname = u.fullname
    user.semester = u.semester
    user.personalemail = u.personalemail
    user.mobilenumber = u.mobilenumber
    const pic = user.image

    // const user= await User.findByIdAndUpdate(id, {u});

    if (req.files) {
      const img = req.files.map(f => ({ url: f.path, filename: f.filename }))
      user.image = img
    }

    if (req.files.length === 0) {
      user.image = pic
    }

    await user.save()

    req.flash('success', 'Successfully updated your profile')
    res.redirect('/viewprofile')
  }
)

app.post('/stats', isLoggedIn, isVerified, isActive, async (req, res) => {
  try {
    const emotion = req.body
    console.log('Received emotion data:', emotion)

    // Validate that we have some emotion data
    const totalTime = parseInt(emotion.total) || 0
    if (totalTime === 0) {
      req.flash(
        'error',
        'No emotion data detected. Please try again and ensure your face is visible.'
      )
      return res.redirect('/home')
    }

    const newEmo = new Emotion({
      happy: parseInt(emotion.happy) || 0,
      neutral: parseInt(emotion.neutral) || 0,
      sad: parseInt(emotion.sad) || 0,
      angry: parseInt(emotion.angry) || 0,
      fearful: parseInt(emotion.fearful) || 0,
      disgusted: parseInt(emotion.disgusted) || 0,
      surprised: parseInt(emotion.surprised) || 0,
      total: totalTime,
      user: req.user._id
    })

    const u = await User.findById(req.user._id)
    u.emotion++
    await u.save()

    await newEmo.save()
    console.log('Emotion data saved:', newEmo)

    res.render('templates/stats.ejs', { emotion: newEmo, id: newEmo._id })
  } catch (error) {
    console.error('Error saving emotion data:', error)
    req.flash('error', 'Failed to save emotion analysis. Please try again.')
    res.redirect('/home')
  }
})

app.get('/bargraph/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Try to find emotion by ID first (new way)
    let actualEmo = await Emotion.findById(id)

    // If not found, fall back to user ID method (old way for compatibility)
    if (!actualEmo) {
      const U = await User.findById(id)
      const e = await Emotion.find({ user: id })
      actualEmo = e[e.length - 1]
    }

    if (!actualEmo) {
      req.flash('error', 'Emotion data not found')
      return res.redirect('/user/stats')
    }

    const jsonData = JSON.stringify({
      labels: [
        'happy',
        'neutral',
        'sad',
        'angry',
        'fearful',
        'disgusted',
        'surprised'
      ],
      values: [
        (actualEmo.happy || 0) / 1000,
        (actualEmo.neutral || 0) / 1000,
        (actualEmo.sad || 0) / 1000,
        (actualEmo.angry || 0) / 1000,
        (actualEmo.fearful || 0) / 1000,
        (actualEmo.disgusted || 0) / 1000,
        (actualEmo.surprised || 0) / 1000
      ]
    })

    res.render('templates/bargraph.ejs', { jsonData, id })
  } catch (error) {
    console.error('Error in bargraph route:', error)
    req.flash('error', 'Failed to load chart data')
    res.redirect('/user/stats')
  }
})

app.get('/piechart/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Try to find emotion by ID first (new way)
    let actualEmo = await Emotion.findById(id)

    // If not found, fall back to user ID method (old way for compatibility)
    if (!actualEmo) {
      const U = await User.findById(id)
      const e = await Emotion.find({ user: id })
      actualEmo = e[e.length - 1]
    }

    if (!actualEmo) {
      req.flash('error', 'Emotion data not found')
      return res.redirect('/user/stats')
    }

    const pieJsonData = JSON.stringify({
      labels: [
        'happy',
        'neutral',
        'sad',
        'angry',
        'fearful',
        'disgusted',
        'surprised'
      ],
      values: [
        (actualEmo.happy || 0) / 1000,
        (actualEmo.neutral || 0) / 1000,
        (actualEmo.sad || 0) / 1000,
        (actualEmo.angry || 0) / 1000,
        (actualEmo.fearful || 0) / 1000,
        (actualEmo.disgusted || 0) / 1000,
        (actualEmo.surprised || 0) / 1000
      ]
    })

    res.render('templates/piechart.ejs', { pieJsonData, id })
  } catch (error) {
    console.error('Error in piechart route:', error)
    req.flash('error', 'Failed to load chart data')
    res.redirect('/user/stats')
  }
})

app.get('/deactivate/:id', isAdmin, async (req, res) => {
  const { id } = req.params
  const u = await User.findById(id)

  u.active = false
  u.save()

  res.redirect('/homeadmin/all')
})

app.get('/activate/:id', isAdmin, async (req, res) => {
  const { id } = req.params
  const u = await User.findById(id)

  u.active = true
  u.save()

  res.redirect('/homeadmin/all')
})

app.get('/declined-request', isAdmin, async (req, res) => {
  const users = await User.find({ verified: false, remark: { $ne: '!ok' } })
  res.render('templates/declinedrequest.ejs', { users })
})

app.get('/forgot-password', (req, res) => {
  res.render('templates/forgotpassword.ejs')
})

// Admin password reset routes
app.get('/admin/reset-password', (req, res) => {
  res.render('templates/adminreset.ejs')
})

app.post('/admin/reset-password', async (req, res) => {
  try {
    // Input sanitization and validation
    const currentUsername = req.body.currentUsername
      ? req.body.currentUsername.trim()
      : ''
    const newPassword = req.body.newPassword || ''
    const confirmPassword = req.body.confirmPassword || ''

    // Log the reset attempt for security monitoring
    console.log(
      `Admin password reset attempt from IP: ${
        req.ip
      } with username: ${currentUsername} at ${new Date().toISOString()}`
    )

    // Validate input presence
    if (!currentUsername || !newPassword || !confirmPassword) {
      console.log('Missing required fields in admin password reset')
      req.flash('error', 'All fields are required')
      return res.redirect('/admin/reset-password')
    }

    // Validate current admin identity
    if (currentUsername !== 'admin') {
      console.log(`Invalid admin username provided: ${currentUsername}`)
      req.flash('error', 'Invalid admin credentials')
      return res.redirect('/admin/reset-password')
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      req.flash('error', 'Passwords do not match')
      return res.redirect('/admin/reset-password')
    }

    // Validate password length
    if (newPassword.length < 1) {
      req.flash('error', 'Password cannot be empty')
      return res.redirect('/admin/reset-password')
    }

    // Find admin user
    const adminUser = await User.findOne({ username: 'admin' })
    if (!adminUser) {
      console.log('Admin user not found during password reset')
      req.flash('error', 'Admin user not found')
      return res.redirect('/admin/reset-password')
    }

    // Update password using passport-local-mongoose method
    await adminUser.setPassword(newPassword)
    await adminUser.save()

    console.log('Admin password reset successful')
    req.flash(
      'success',
      'Admin password reset successfully. Please login with your new password.'
    )
    res.redirect('/login/admin')
  } catch (error) {
    console.error('Error during admin password reset:', error)
    req.flash(
      'error',
      'An error occurred during password reset. Please try again.'
    )
    res.redirect('/admin/reset-password')
  }
})

app.post('/otp-verification-page', async (req, res) => {
  const enrollment = req.body.enrollment
  var u = 0

  u = await User.find({ username: enrollment })
  if (Object.entries(u).length === 0) {
    req.flash('error', `No account with the Enrollment number "${enrollment}"`)
    return res.redirect('/forgot-password')
  }

  var otp = ''

  for (let i = 0; i < 6; i++) {
    const randomInt = Math.ceil(Math.random() * 9)
    otp += randomInt
  }

  req.session.otp = otp

  const msg = {
    to: `${u[0].gsuite}`,
    from: 'tejaspawar62689@gmail.com',
    subject: 'Emotion Analytics',
    text: `OTP: ${otp}`,
    html: `<p>Your OTP for resetting the Password for Emotion Analytics: <br> <b>${otp}</b></p> <hr> <img src="https://res.cloudinary.com/dxo8tirbk/image/upload/v1709249909/EmotionAnalytics/logo_wj2ma2.png" alt="can't load the image at the moment">
     <div>&copy; 2024 Emotion Analytics. All rights reserved</div>`
  }

  sgMail
    .send(msg)
    .then(() => console.log('Email sent'))
    .catch(error => console.error(error))

  res.render('templates/otpverification.ejs', { u })
})

app.post('/change-password/:id', async (req, res) => {
  const { id } = req.params
  const u = await User.findById(id)

  const r = req.body
  var response_otp = r.x1 + r.x2 + r.x3 + r.x4 + r.x5 + r.x6
  if (req.session.otp && req.session.otp == response_otp) {
    delete req.session.otp // Clear OTP after use
    res.render('templates/changepassword.ejs', { u })
  } else {
    req.flash('error', 'Incorrect OTP')
    res.redirect('/forgot-password')
  }
})

app.post('/update-password/:id', async (req, res, next) => {
  const { id } = req.params

  const user = await User.findById(id).select('+hash')

  const data = generateRandomString(5 + Math.ceil(Math.random() * 10))

  const temp = new User({
    fullname: data,
    username: data,
    personalemail: data,
    gsuite: data,
    semester: data,
    mobilenumber: data,
    password: req.body.password_cp
  })
  const newUser = await User.register(temp, req.body.password_cp)

  const newHashedPass = newUser.hash
  const newSalt = newUser.salt

  await User.findOneAndDelete({ username: data })

  try {
    user.hash = newHashedPass
    user.salt = newSalt
    user.save()
    req.flash(
      'success',
      'Successfully changed the password. Now Login with new Password'
    )
    res.redirect('/login')
  } catch (e) {
    console.log('CAUGHT ERR')
    console.log(e)
  }
})

app.post('/resubmission/:id', upload.array('image'), async (req, res) => {
  const { id } = req.params
  const u = req.body
  const user = await User.findById(id)
  user.fullname = u.fullname
  user.username = u.username
  user.semester = u.semester
  user.personalemail = u.personalemail
  user.mobilenumer = u.mobilenumber
  user.remark = '!ok'
  const pic = user.image

  if (req.files) {
    const img = req.files.map(f => ({ url: f.path, filename: f.filename }))
    user.image = img
  }

  if (req.files.length === 0) {
    user.image = pic
  }

  await user.save()
  k += 1

  req.flash('success', 'Successfully updated your registered data')
  res.redirect(`/approval/${id}`)
})

// User Statistics Route
app.get('/user/stats', isLoggedIn, isVerified, isActive, async (req, res) => {
  try {
    const userId = req.user._id
    const emotions = await Emotion.find({ user: userId }).sort({
      createdAt: -1
    })
    const user = await User.findById(userId)

    // Ensure emotions array exists and has valid data
    const validEmotions = emotions.filter(emotion => emotion && emotion._id)

    res.render('templates/userstats.ejs', { emotions: validEmotions, user })
  } catch (error) {
    console.error('Error fetching user stats:', error)
    req.flash('error', 'Failed to load statistics')
    res.redirect('/viewprofile')
  }
})

// Delete Emotion Record Route
app.delete(
  '/emotion/:id',
  isLoggedIn,
  isVerified,
  isActive,
  async (req, res) => {
    try {
      const emotionId = req.params.id
      const emotion = await Emotion.findById(emotionId)

      // Check if the emotion belongs to the current user
      if (!emotion || emotion.user.toString() !== req.user._id.toString()) {
        req.flash('error', 'Unauthorized access')
        return res.redirect('/user/stats')
      }

      await Emotion.findByIdAndDelete(emotionId)
      req.flash('success', 'Emotion record deleted successfully')
      res.redirect('/user/stats')
    } catch (error) {
      console.error('Error deleting emotion:', error)
      req.flash('error', 'Failed to delete emotion record')
      res.redirect('/user/stats')
    }
  }
)

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
  console.log(`app started successfully at port ${PORT}`)
})
