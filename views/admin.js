const fs = require('fs');
const request = require('request');
const Twit = require('twit');
const { Op } = require('sequelize');

const { Session, User, Listings } = require('../models');
const { error404, getListing, getListings, getUsers } = require('./utils');
const { API_FLASH, PRODUCTION } = require('../settings');

const { sendEmail } = require('../utils/email-api');
const { templates } = require('../utils/email-templates');

const T = new Twit({
    consumer_key: 'EaJkmFZYGayFLqTH7b5HJ1t8g',
    consumer_secret: 'fjmYctincdOdc7voPFaKq6BpffJe60mh8rNoESITrEOCtQHtsi',
    access_token: '38120897-hpqHMem1lo9Ppo775V1KcR4oYWuev2UTmoH59XcMO',
    access_token_secret: 'emrbcXG491LNXWol4BE6utoJultbJxCq6i6YQ8N6vTY4D',
});

const admin = async (req, res, next) => {
    const session = await Session.findOne({ where: { sessionId: req.cookies.sessionId } });
    if (!session) return error404(res);

    const user = await User.findOne({ where: { email: session.email } });
    if (!user) return error404(res);

    if (user.email === 'kumailht@gmail.com') return next();

    return error404(res)
};


module.exports = function (app) {
    app.get('/adm/', admin, async function (req, res) {
        const sessions = await Session.findAll({ raw: true, nest: true });
        const sessionCount = sessions.length;

        res.render('admin/index.html', { sessionCount });
    });

    app.get('/moderate/subs/', async function (req, res) {
        const users = await User.findAll({
            where: {
                email_verified: true,
                hash: {
                    [Op.not]: null, 
                },
            },
            order: [['createdAt', 'DESC']],
            raw: true,
            nest: true,
        });

        // filter, remove users with "kumailht"
        const filteredUsers = users.filter(
            (user) => !user.email.includes('kumailht'),
        );

        // subs
        const subs = await User.findAll({
            where: {
                email_verified: true,
                hash: {
                    [Op.is]: null,
                },
            },
            order: [['createdAt', 'DESC']],
            raw: true,
            nest: true,
        });

        return res.render('admin/subs.html', {
            users: filteredUsers,
            subs,
        });
    });

    app.get('/moderate/email/', function (req, res) {
        Listings.find({ approved: true })
            .sort({ createdAt: -1 })
            .limit(4)
            .exec(function (err, listings) {
                if (err) {
                    return res.sendStatus(500);
                }

                res.render('admin/email/template.html', {
                    listings: shuffle(listings),
                    authenticated: true,
                });
            });
    });

    app.get('/moderate/email/plain', function (req, res) {
        Listings.find({ approved: true })
            .sort({ createdAt: -1 })
            .limit(4)
            .exec(function (err, listings) {
                if (err) {
                    return res.sendStatus(500);
                }

                res.render('admin/email/plain.txt', {
                    listings: shuffle(listings),
                    authenticated: true,
                });
            });
    });

    app.get('/moderate/', function (req, res) {
        // within the last 6 months
        Listings.find({
            // within the last 6 months
            createdAt: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 7))
            }
        })
            .sort({ createdAt: -1 })
            .exec(function (err, listings) {
                if (err) {
                    return res.sendStatus(500);
                }

                res.render('admin/moderate.html', {
                    listings,
                    authenticated: true,
                });
            });
    });

    app.get('/moderate/:_id/screenshots', async function (req, res) {
        const { _id } = req.params;
        const listing = await getListing(_id);
        res.render('admin/screenshots.html', {
            listing,
        });
    });

    app.post('/moderate/:_id/delete', async function (req, res) {
        const { _id } = req.params;
        const listing = await getListing(_id);

        // Delete all screenshots
        if (listing.supportingScreenshots) {
            listing.supportingScreenshots.forEach(function (screenshotPath) {
                console.log(screenshotPath)
                fs.unlink('public'+screenshotPath, function (err) {
                    console.log(err)
                    // Handle error if needed
                });
            });
        }

        Listings.remove({ _id }, {}, function (err, numremoved) {
            if (err) {
                return res.sendStatus(500);
            }

            res.redirect('/moderate');
        });
    });

    app.post('/moderate/:_id/tweet', async function (req, res) {
        const { _id } = req.params;
        const listing = await getListing(_id);
        
        T.post(
            'statuses/update',
            {
                // status: `${listing.projectName} is for sale (${listing.price} or best offer) https://borderline.biz/listing/${listing._id}/`,
                status: `New startup for sale https://borderline.biz/listing/${listing._id}/`,
            },
            (err, reply) => {
                if (err) {
                    console.log('Error: ', err.message);
                } else {
                    console.log('Success: ', reply);
                }
            },
        );

        res.redirect('/moderate');
    });

    app.post('/moderate/delete_all_unapproved', function (req, res) {
        const { _id } = req.params;
        Listings.remove({ approved: false }, { multi: true }, function (err, numremoved) {
            if (err) {
                return res.sendStatus(500);
            }

            res.redirect('/moderate');
        });
    });

    app.post('/moderate/:_id/approve', function (req, res) {
        const { _id } = req.params;

        Listings.update({ _id }, { $set: { approved: true } }, {}, function (err, numReplaced) {
            if (err) {
                return res.sendStatus(500);
            }

            Listings.findOne({ _id }).exec(function (err, listing) {
                if (err) {
                    return res.sendStatus(500);
                }

                if (PRODUCTION) {
                    sendEmail(
                        `Congrats! ${listing.projectName} is live on Borderline`,
                        templates.listingApproved(listing),
                        listing.emailAddress,
                    );

                    T.post(
                        'statuses/update',
                        {
                            status: `${listing.projectName} is for sale ($${listing.price} or best offer) https://borderline.biz/listing/${listing._id}/`,
                        },
                        (err, reply) => {
                            if (err) {
                                console.log('Error: ', err.message);
                            } else {
                                console.log('Success: ', reply);
                            }
                        },
                    );
                }

                res.redirect('/moderate');
            });
        });
    });

    // unapprove a listing
    app.post('/moderate/:_id/unapprove', function (req, res) {
        const { _id } = req.params;

        Listings.update({ _id }, { $set: { approved: false } }, {}, function (err, numReplaced) {
            if (err) {
                return res.sendStatus(500);
            }

            res.redirect('/moderate');
        });
    });


    app.post('/moderate/:_id/reject', async function (req, res) {
        const { _id } = req.params;
        const listing = await getListing(_id);
        const reason = req.body.reason;

        if (!reason) return res.send('no reason?');

        sendEmail(
            `${listing.projectName} cannot be listed on Borderline`,
            templates.rejectReason(listing, reason),
            listing.emailAddress,
        );

        Listings.update({ _id }, { $inc: { rejectCount: 1 } }, {}, function (err, numReplaced) {
            if (err) return res.sendStatus(500);
            return res.redirect('/moderate');
        });

    });


    app.post('/moderate/:_id/feature-listing', async function (req, res) {
        const { _id } = req.params;
        const listing = await getListing(_id);

        Listings.update({ _id }, { $set: { featuredListing: listing.featuredListing ? false : true } }, {}, function (err, numReplaced) {
            if (err) return res.sendStatus(500);
            res.redirect('/moderate');
        });

    });


    app.post('/moderate/:_id/sold', function (req, res) {
        const { _id } = req.params;

        Listings.update({ _id }, { $set: { sold: true } }, {}, function (err, numReplaced) {
            if (err) {
                return res.sendStatus(500);
            }

            res.redirect('/moderate');
        });
    });


    app.post('/moderate/:_id/sendConfirmation', function (req, res) {
        const { _id } = req.params;

        Listings.findOne({ _id }).exec(function (err, listing) {
            if (err) return res.sendStatus(500);

            const projectName = listing.projectName;
            const email = listing.emailAddress;

            sendEmail(
                `${projectName} | Borderline.biz`,
                `Hi,

This is Kumail from Borderline.biz. This is regarding your listing ${projectName}.

Your listing will be approved and will go live soon.

Before it goes live, can you confirm that you're okay with the 3% success fee?
(you only have to pay if you get a buyer from Borderline.biz. And you'll have to notify us on a successful sale).

Let me know if you have any questions.

Thanks,
Kumail`,
                email
            );

            Listings.update({ _id }, { $inc: { confirmationsSent: 1 } }, {}, function (err, numReplaced) {
                if (err) return res.sendStatus(500);
            });


            res.redirect('/moderate');
        });
    });

    /*
     * _id is the id of the project
     * redirects to moderate listing page when successful
     * */
    app.post('/moderate/:_id/fetchScreenshot', function (req, res) {
        const { _id } = req.params;
        Listings.findOne({ _id }).exec(function (err, listing) {
            if (err) {
                return res.sendStatus(500);
            }
            request(
                {
                    url: API_FLASH.url,
                    encoding: 'binary',
                    qs: {
                        access_key: API_FLASH.access_key,
                        url: listing.projectLink,
                        scroll_page: true,
                        format: API_FLASH.picFormat,
                        quality: 60,
                        delay: 1,
                        width: 1072,
                        // full_page: true,
                        height: 1300,
                        // You can scale images down further
                        // thumbnail_width: 700
                    },
                },
                (error, response, body) => {
                    if (error) {
                        console.log(error);
                    } else {
                        // Express's routing lowercases all URLs by default
                        fs.writeFile(`./public/screenshots/listings/${listing._id.toLowerCase()}.${API_FLASH.picFormat}`, body, 'binary', (error) => {
                            console.log(error);
                        });
                        return res.redirect('/moderate');
                    }
                },
            );
        });
    });


    app.get('/moderate/preview_email/:_id', async function (req, res) {
        const { _id } = req.params;

        const listing = await getListing(_id);

        return res.send(`
            <html>
            <h1>Preview email</h1>
            <pre>${templates.newListing(listing)}</pre>
            </html>
        `);
    });

    app.post('/moderate/:_id/sendEmails', async function (req, res) {
        /*

        1. Get all users that have email_verified = true
        2. get listing by id
        3. send email to all users with listing

        */
        const { _id } = req.params;
        const users = await getUsers();
        const emails = PRODUCTION ? users.map((user) => user.email) : ['kumailht@gmail.com'];
        console.log(`CAUTION: Sending emails to ${emails.length} users (production = ${PRODUCTION})`);
        const listing = await getListing(_id);
        const emailBody = templates.newListing(listing);

        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];

            sendEmail(
                `${listing.projectName} is for sale`,
                emailBody,
                email,
            );
        }

        // Update Listing. Incpxent emailsSent
        Listings.update({ _id }, { $inc: { emailsSent: 1 } }, {}, function (err, numReplaced) {
            if (err) return res.sendStatus(500);
        });

        res.send('Emails sent');
    });

    // /moderate/send_checkup_email
    app.post('/moderate/send_checkup_email', async function (req, res) {
        const listings = await getListings({
            approved: true,
            // within the last 3 months
            createdAt: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
        });

        for (let i = 0; i < listings.length; i++) {
            const listing = listings[i];

            sendEmail(
                `${listing.projectName} | Borderline listing`,
                templates.sellerCheckUp(listing),
                listing.emailAddress,
            );
        }

        res.send('Emails sent');
    });

    // /moderate/send_feature_email
    app.post('/moderate/send_feature_email', async function (req, res) {
        const listings = await getListings({
            approved: true,
            // within the last 3 months
            createdAt: {
                $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
        });

        for (let i = 0; i < listings.length; i++) {
            const listing = listings[i];

            sendEmail(
                `${listing.projectName} | Borderline listing`,
                templates.featureYourListing(listing),
                listing.emailAddress,
            );
        }

        res.send('Emails sent');
    });


    /*
     * _id is the listing id
     * this function deletes the screenshot
     * */
    function deleteScreenshot(_id) {
        const path = `./public/screenshots/listings/${_id.toLowerCase()}.${API_FLASH.picFormat}`;
        if (fs.existsSync(path)) {
            fs.unlink(path, (err) => {
                return err;
            });
            return 'file deleted';
        } else {
            return 'file does not exist';
        }
    }
};