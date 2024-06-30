const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');
const { v4: uuid, validate: uuidValidate } = require('uuid');

const { APP_URL, JWT_SECRET, RECAPTCHA_SECRET_KEY } = require('../settings');

const { User, Session } = require('../models');

const { sendEmail } = require('../utils/email-api');
const { getUser, error500 } = require('./utils');

// HELPERS
const validEmailRx =
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const validPasswordRx = /^.{8,}$/;

function decodeJwtToken(token) {
    // Validity period
    const dateNow = new Date();
    const hours = 72;
    const tokenLife = hours * 60 * 1000;

    const invalid = { decoded: null, valid: false };

    let decoded;

    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return invalid;
    }

    // has the token expired?
    const tokenTime = decoded.iat * 1000;
    const expired = tokenTime + tokenLife < dateNow.getTime();
    if (expired) return invalid;

    return { decoded, valid: true };
};

async function isAuthenticated(req) {
    const sessionId = req.cookies.sessionId;
    
    if (sessionId) {
        const session = await Session.findOne({ where: { sessionId } });
        
        // Session exists, let them pass
        if (session) return true;
    }

    return false;
}

// Middleware function to check if user is logged in
async function loginRequired(req, res, next) {
    if (await isAuthenticated(req)) return next();

    res.redirect('/account/signup/');
};

// Middleware function to validate captcha
async function captchaRequired(req, res, next) {
    const SECRET_KEY = RECAPTCHA_SECRET_KEY;
    const captchaToken = req.body['g-recaptcha-response'];

    // If captcha token is not provided, return an error response
    if (!captchaToken) {
        return res.status(400).send('Please complete the captcha');
    }

    try {
        // Make a POST request to Google's reCAPTCHA verification endpoint
        const response = await axios.post(`https://www.google.com/recaptcha/api/siteverify?secret=${SECRET_KEY}&response=${captchaToken}`);

        // If successful response from reCAPTCHA
        if (response.data.success) {
            // If captcha validation is successful, proceed to the next middleware or route handler
            next();
        } else {
            // If captcha validation fails, return an error response
            return res.status(400).json({ error: 'Captcha validation failed' });
        }
    } catch (error) {
        // If an error occurs during captcha validation, return an error response
        console.error('Captcha validation error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


// ROUTES
function views(app) {
    app.get('/account/', loginRequired, async function (req, res) {
        const session = await Session.findOne({ where: { sessionId: req.cookies.sessionId } });
        const user = await User.findOne({ where: { email: session.email } });
        return res.render('account/account.html', { user });
    });

    app.get('/account/profile/private/', loginRequired, async function (req, res) {
        const user = await getUser(req);
        user.public = false;
        await user.save();
        
        return res.redirect(req.headers.referer);
    });

    app.get('/account/profile/public/', loginRequired, async function (req, res) {
        const user = await getUser(req);

    return res.redirect(req.headers.referer);
    });

    app.get('/account/profile/', loginRequired, async function (req, res) {
        const session = await Session.findOne({ where: { sessionId: req.cookies.sessionId } });
        const user = await User.findOne({ where: { email: session.email }, raw: true });
        
        return res.render('account/profile.html', user);
    });

    app.post('/account/profile/', loginRequired, async function (req, res) {
        const session = await Session.findOne({ where: { sessionId: req.cookies.sessionId } });
        const user = await User.findOne({ where: { email: session.email } });

        // Validate form fields
        let { username, first_name, last_name, about, twitter, website } = req.body;

        // trim fields
        username = username.trim();
        first_name = first_name.trim();
        last_name = last_name.trim();
        about = about.trim();
        twitter = twitter.trim();
        website = website.trim();

        const errors = [];

        // validate username, must be unique, not have swear words, and not be a reserved word
        if (!username) errors.push('Username is required');
        if (username) {
            if (username.length < 6) errors.push('Username must be at least 6 characters long');
            if (username.length > 32) errors.push('Username must be less than 32 characters long');
            if (!username.match(/^[a-zA-Z0-9_]+$/)) errors.push('Username must only contain letters, numbers, and underscores');

            // check for uniqueness, exclude current user
            const userWithUsername = await User.findOne({ where: { username }, raw: true });
            if (userWithUsername && userWithUsername.email !== user.email) errors.push('Username is already taken');
        }

        // validate first_name, last_name
        if (!first_name) errors.push('First name is required');
        if (!last_name) errors.push('Last name is required');

        // First name and last name must be at least 2 characters long, less than 32 characters long, and only contain letters without spaces
        if (first_name) {
            if (first_name.length < 2) errors.push('First name must be at least 2 characters long');
            if (first_name.length > 32) errors.push('First name must be less than 32 characters long');
            if (!first_name.match(/^[a-zA-Z]+$/)) errors.push('First name must only contain letters');
        }

        if (last_name) {
            if (last_name.length < 2) errors.push('Last name must be at least 2 characters long');
            if (last_name.length > 32) errors.push('Last name must be less than 32 characters long');
            if (!last_name.match(/^[a-zA-Z]+$/)) errors.push('Last name must only contain letters');
        }

        // validate about, must only contain letters, numbers, spaces and emojis
        if (about) {
            if (about.length > 240) errors.push('About must be less than 240 characters long');
        }

        // validate twitter and website URLs
        if (twitter) {
            if (!twitter.match(/^(https?:\/\/)?(www\.)?twitter\.com\/[a-zA-Z0-9_]+\/?$/)) errors.push('Twitter URL is invalid');
        }

        if (website) {
            if (!website.match(/^(https?:\/\/)?(www\.)?[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\/?$/)) errors.push('Website URL is invalid');
        }

        if (errors.length) {
            return res.render('account/profile.html', { errors, user: user.get({ plain: true }), username, first_name, last_name, about, twitter, website });
        } else {
            user.public = true;
            user.username = username;
            user.first_name = first_name;
            user.last_name = last_name;
            if (about) user.about = about;
            if (twitter) user.twitter = twitter;
            if (website) user.website = website;
            await user.save();

            return res.render('account/profile.html', { success: 'Profile updated successfully', user: user.get({ plain: true }) });
        }
    });

    app.get('/account/login/', async function (req, res) {
        if (await isAuthenticated(req)) return res.redirect('/dashboard/');

        res.render('account/login.html', {});
    });

    app.post('/account/login/', captchaRequired, async function (req, res) {
        const { email, password } = req.body;
        const render = (params) => res.render('account/login.html', params);
        const error = (error) =>
            render({
                errors: [error],
                email, // Persist email input field in the event of an error
            });

        // Check if password exists
        if (!password.length) return error('Email or password is invalid');

        // Check if user exists
        const user = await User.findOne({ where: { email } });
        const userExists = user && user.email === email && user.hash;
        if (!userExists) return error('Email or password is invalid');

        // Check if password is correct
        const valid = await bcrypt.compare(password, user.hash);
        if (!valid) return error('Email or password is invalid');

        // Check if user is verified
        if (!user.email_verified) {
            // 307 preserves the send method. Since this is a POST request, the redirect will also be a POST.
            const token = jwt.sign({ email }, JWT_SECRET);
            return res.redirect(307, '/account/send-verification-email/?token=' + token);
        }

        // Check if already logged in
        const loggedIn = await Session.findOne({ where: { email } });
        if (loggedIn) {
            // resave cookie with expiration date 30 days from now
            res.cookie('sessionId', loggedIn.sessionId, { maxAge: 30 * 24 * 60 * 60 * 1000 });
            return res.redirect('/account/');
        }

        // Establish session for not logged in users
        const sessionId = crypto.randomBytes(48).toString('base64');
        res.cookie('sessionId', sessionId, { maxAge: 30 * 24 * 60 * 60 * 1000 });

        // store db session
        const session = new Session({ sessionId, email });

        try {
            await session.save();
        } catch (e) {
            return error500(res);
        }

        return res.redirect('/');
    });

    app.get('/account/signup/', function (req, res) {
        if (res.locals.isAuthenticated) return res.redirect('/account/');

        res.render('account/signup.html', {});
    });
    app.post('/account/signup/', captchaRequired, async function (req, res) {
        const render = (params) => res.render('account/signup.html', params);
        const error = (error) =>
            render({
                errors: [error],
                email, // Persist email input field in the event of an error
            });

        const { email, password, repeat_password } = req.body;

        //
        // VALIDATE EMAIL & PASS
        if (!validEmailRx.test(email)) return error('Email address is not valid');

        const existingUser = await User.findOne({ where: { email } });
        const userExists = existingUser && existingUser.email === email && existingUser.email_verified && existingUser.hash;
        if (userExists) return error(`An account with email address ${email} already exists`);

        if (password !== repeat_password) return error(`Passwords don't seem to match`);

        if (!validPasswordRx.test(password))
            return error('Password is too weak. Minimum eight characters.');

        // CREATE USER
        const hash = await bcrypt.hash(password, 10);

        let user;
        if (existingUser) {
            user = existingUser;
            user.hash = hash;
        } else {
            user = User.build({ email, hash });
        }

        try {
            await user.save();
        } catch (e) {
            console.error(e);
            return error500(res);
        }

        // ADD JWT TOKEN TO URL
        const token = jwt.sign({ email }, JWT_SECRET);

        // SUCCESS
        // // 307 preserves the send method. Since this is a POST request, the redirect will also be a POST.
        return res.redirect(307, '/account/send-verification-email/?token=' + token);
    });

    app.get('/account/send-verification-email/', async function (req, res) {
        const { email, status } = req.query;

        return res.render('account/verify.html', { email, status });
    });

    app.post('/account/send-verification-email/', async function (req, res) {
        const { token } = req.query;
        const { email } = req.body;

        if (!email) return error500(res);

        // Verify the token
        const { decoded, valid } = decodeJwtToken(token);

        // check if email exists in db
        if (!decoded.email) return error500(res);
        const isValid = valid && await User.findOne({ where: { email: decoded.email } });

        // Token invalid or user doesn't exist
        if (!isValid) return error500(res);

        try {
            console.log('SENDING EMAIL', email, token);
            const response = sendEmail(
'Verify your email | borderline.biz',
`
Hey there,

You gotta 2 things to verify your email:

1. Please click this link: <br> ${APP_URL}/account/verify-email/${token}

2. Please respond to this email with "hello!" so future emails don't go to spam 🙏

Thanks,
Kumail
`,
                email
            );

            return res.redirect(`/account/send-verification-email/?status=sent&email=${email}&token=${token}`);
        } catch (err) {
            return error500(res);
        }
    });

    app.get('/account/verify-email/:token/', async function (req, res) {
        const { token } = req.params;
        const { decoded, valid } = decodeJwtToken(token);
        const email = decoded ? decoded.email : null;

        // Token expired
        if (!valid || !email) {
            return res.redirect(`/account/send-verification-email/?status=expired&email=${email}`);
        }

        // User registered on time
        try {
            const user = await User.findOne({ where: { email } });
            user.email_verified = true;
            user.save();

            return res.render('account/verified.html', { user });
        } catch (err) {
            console.error(err);
            return error500(res);
        }

    });

    app.get('/account/logout/', loginRequired, async function (req, res) {
        const sessionId = req.cookies.sessionId;
        
        await Session.destroy({
            where: { sessionId },
            force: true
            });

        res.cookie('sessionId', '');

        res.render('account/logged-out.html', {});
    });

    app.get('/account/forgot/', function (req, res) {
        const { status, email } = req.query;
        res.render('account/forgot.html', { status, email });
    });

    app.post('/account/forgot/', async function (req, res) {
        const { email } = req.body;

        // check if email exists
        const user = await User.findOne({ where: { email } });
        if (!user) return res.redirect(`/account/forgot/?status=invalid&email=${email}`);

        // send email with link to reset
        const token = jwt.sign({ email }, JWT_SECRET);

        try {
            const response = await sendEmail(
                'Reset your password (borderline.biz)',
                `Please click this link to reset your paasword: <br> ${APP_URL}/account/reset/${token}`,
                email
            );
            return res.redirect(`/account/forgot/?status=sent&email=${email}`);
        } catch (err) {
            return error500(res);
        }
    });

    app.get('/account/reset/:token/', async function (req, res) {
        const { token } = req.params;
        const { decoded, valid } = decodeJwtToken(token);

        // Token expired
        if (!valid) return res.redirect(`/account/forgot/?status=expired`);

        res.render('account/reset.html', {});
    });

    app.post('/account/reset/:token/', async function (req, res) {
        const render = (params) => res.render('account/reset.html', params);
        const error = (error) => render({ errors: [error] });

        const { password, repeat_password } = req.body;

        const { token } = req.params;
        const { decoded, valid } = decodeJwtToken(token);
        const { email } = decoded;

        if (!valid) return res.redirect(`/account/forgot/?status=expired`);

        if (password !== repeat_password) return error(`Passwords don't seem to match`);

        if (!validPasswordRx.test(password))
            return error('Password is too weak. Minimum eight characters.');

        // update password
        const hash = await bcrypt.hash(password, 10);
        const user = await User.findOne({ where: { email }});
        user.hash = hash;

        try {
            await user.save();
        } catch (e) {
            return error500(res);
        }

        render({ status: 'success' });
    });

    app.get('/account/change/', function (req, res) {
        res.render('account/change.html');
    });

    app.post('/account/change/', loginRequired, async function (req, res) {
        const render = (params) => res.render('account/change.html', params);
        const error = (error) => render({ errors: [error] });

        const { password, new_password, repeat_new_password } = req.body;

        // Check current password
        const session = await Session.findOne({ where: { sessionId: req.cookies.sessionId } });
        const user = await User.findOne({ where: { email: session.email } });
        const current_valid = await bcrypt.compare(password, user.hash);

        if (!current_valid) return error('Current password is incorrect');

        // Check new password
        if (new_password !== repeat_new_password) return error(`New passwords don't seem to match`);

        if (!validPasswordRx.test(password))
            return error('Password is too weak. Minimum eight characters.');

        // update password
        const hash = await bcrypt.hash(new_password, 10);
        user.hash = hash;

        try {
            await user.save();
        } catch (e) {
            return error500(res);
        }

        render({ status: 'success' });
    });

    app.get('/subscribed/', function (req, res) {
        res.render('subscribed.html');
    });

    app.post('/subscribe/', captchaRequired, async function (req, res) {
        const { email } = req.body;

        // check if email exists
        let user = await User.findOne({ where: { email } }, { raw: true });
        
        if (!user) user = await User.create({ email });

        // Check if user is verified
        if (!user.email_verified) {
            // 307 preserves the send method. Since this is a POST request, the redirect will also be a POST.
            const token = jwt.sign({ email }, JWT_SECRET);
            return res.redirect(307, '/account/send-verification-email/?token=' + token);
        }

        return res.redirect('/subscribed');
    });
}

module.exports = { views, loginRequired, isAuthenticated }

