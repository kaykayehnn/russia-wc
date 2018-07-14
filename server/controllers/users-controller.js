const encryption = require('../utilities/encryption')
const User = require('../models/User')

const emailRgx = /^[^@]{2,}@(?:\w{2,}\.)+\w{2,}$/
const NOT_FOUND = 404

exports.registerPost = (req, res, next) => {
  let {
    email,
    password,
    repeatPassword
  } = req.body

  if (!emailRgx.test(email)) {
    return void next(new Error('Invalid email'))
  }
  if (password !== repeatPassword) {
    return void next(new Error('Passwords don\'t match'))
  }
  if (password.length < 3) {
    return void next(new Error('Password must be at least 3 characters long'))
  }

  let salt = encryption.generateSalt()
  let newUser = {
    email,
    salt: salt,
    hashedPass: encryption.generateHashedPassword(salt, password),
    roles: ['user']
  }

  User.create(newUser)
    .then(newUser => {
      req.user = newUser.toPayload()
      return req.logIn()
    })
    .then(data => res.json(data))
    .catch(next)
}

exports.loginPost = (req, res, next) => {
  let reqUser = req.body
  User
    .findOne({
      email: reqUser.email
    })
    .then(user => {
      if (user == null || !user.authenticate(reqUser.password)) {
        return void next(new Error('Invalid credentials'))
      }

      req.user = user.toPayload()
      return req.logIn()
    })
    .then(data => res.end(data))
    .catch(next)
}

exports.logout = (req, res, next) => {
  req.logOut()
    .then(data => {
      res.json(data)
    })
    .catch((err) => {
      console.log(err)
      next(err)
    })
}

exports.getByEmail = (req, res) => {
  let email = req.params.userEmail
  User.findOne({ email })
    .then(user => {
      if (!user) {
        return void res.sendStatus(NOT_FOUND)
      }

      res.json(user.toPayload())
    })
}

exports.getAllUsers = (req, res) => {
  User.find(null, { salt: 0, hashedPass: 0 })
    .lean()
    .then(users => {
      res.json(users)
    })
}

const invalidateArr = (arr) => !Array.isArray(arr) || arr.some(a => typeof a !== 'string')

exports.editUser = (req, res) => {
  let { userId } = req.params
  let { roles, favouriteTeams, avatarIx } = req.body

  if (invalidateArr(roles) || invalidateArr(favouriteTeams)) {
    return void res.end()
  }

  User.findById(userId)
    .then(user => {
      if (!user) return void res.end()

      user.roles = roles
      user.favouriteTeams = favouriteTeams
      user.avatarIx = avatarIx

      user.save()
        .then(() => res.json(user))
    })
}

exports.deleteUser = (req, res, next) => {
  let { userId } = req.params

  User.findByIdAndRemove(userId)
    .then(() => res.end())
    .catch(() => next(new Error(`User ${userId} doesn't exist`)))
}

exports.setFavouriteTeams = (req, res) => {
  let { userId } = req.params
  let { teams } = req.body
  if (!Array.isArray(teams) || teams.some(a => typeof a !== 'string')) {
    return void res.end()
  }

  User.findById(userId)
    .then(user => {
      if (!user) res.end()

      user.favouriteTeams = teams
      req.user = user.toPayload()

      user.save()
        .then(() => req.logIn())
        .then(data => res.json(data))
    })
}
