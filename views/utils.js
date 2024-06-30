const { Session, User, Listings } = require('../models');
const { Op } = require('sequelize');
const MRR_THRESHOLD = 20;

function error500(res) {
    return res.status(500).send(`
        <br><br>
        <center><code><b>Server Error.</b> Please visit the <a href="/">homepage</a>.</code></center>
        <!-- <script>setTimeout(() => { window.location.href = '/' }, 1000)</script> -->
    `);
}

function error404(res) {
    return res.status(500).send(`
        <br><br>
        <center><code><b>Not found.</b> Please visit the <a href="/">homepage</a>.</code></center>
        <!-- <script>setTimeout(() => { window.location.href = '/' }, 1000)</script> -->
    `);
}

async function getUser(req) {
    if (!req) return null;

    const sessionId = req.cookies.sessionId || req.anonymousSessionId;
    if (!sessionId) return null;

    const session = await Session.findOne({ where: { sessionId } });
    if (!session) return null;

    const user = await User.findOne({ where: { email: session.email } });
    if (!user) return null;

    return user;
}


async function getUsers(verfied = true) {
    const users = await User.findAll({
        where: {
            email_verified: verfied,
        },
        raw: true,
        nest: true,
    });

    return users;
}


function sortListings(listings, sort) {
    if (sort === 'oldest') {
        listings = listings.reverse();
    } else if (sort === 'price-low-to-high') {
        listings = listings.sort((a, b) => {
            const aPrice = Number(a.price.replace(/[^0-9.]/g, ''));
            const bPrice = Number(b.price.replace(/[^0-9.]/g, ''));
            return aPrice - bPrice;
        });
    } else if (sort === 'price-high-to-low') {
        listings = listings.sort((a, b) => {
            const aPrice = Number(a.price.replace(/[^0-9.]/g, ''));
            const bPrice = Number(b.price.replace(/[^0-9.]/g, ''));
            return bPrice - aPrice;
        });
    } else if (sort === 'popular') {
        listings = listings.sort((a, b) => {
            const aPopularity = (a.visitCount || 1) * ((a.revealCount) || 1);
            const bPopularity = (b.visitCount || 1) * ((b.revealCount) || 1);
            return bPopularity - aPopularity;
        });
    } else if (sort === 'most-contacted') {
        listings = listings.sort((a, b) => {
            const aPopularity = (a.revealCount || 0);
            const bPopularity = (b.revealCount || 0);
            return bPopularity - aPopularity;
        });
    } else if (sort === 'high-mrr') {
        listings = listings.sort((a, b) => {
            a = (Number(a?.mrr.replace(/[^0-9.]/g, '') || 0));
            b = (Number(b?.mrr.replace(/[^0-9.]/g, '') || 0));
            return b - a;
        });
    } else if (sort === 'low-mrr') {
        listings = listings.sort((a, b) => {
            a = (Number(a?.mrr.replace(/[^0-9.]/g, '') || 0));
            b = (Number(b?.mrr.replace(/[^0-9.]/g, '') || 0));
            return a - b;
        });
    } else if (sort === 'low-multiple') {
        listings = listings.sort((a, b) => {
            const aMRR = (Number(a?.mrr.replace(/[^0-9.]/g, '') || 0));
            const bMRR = (Number(b?.mrr.replace(/[^0-9.]/g, '') || 0));

            const aPrice = Number(a.price.replace(/[^0-9.]/g, ''));
            const bPrice = Number(b.price.replace(/[^0-9.]/g, ''));


            return (aPrice / aMRR) - (bPrice / bMRR);
        });
    } else if (sort === 'supporting-documents') {
        listings = listings.sort((a, b) => {
            const aSupportingScreenshots = a.supportingScreenshots ? a.supportingScreenshots.length : 0;
            const bSupportingScreenshots = b.supportingScreenshots ? b.supportingScreenshots.length : 0;
            return bSupportingScreenshots - aSupportingScreenshots;
        });
    }

    return listings;
}

function formatPrice(listing) {
    try {
        // remove decimal point
        const price = listing.price.replace('.', '');

        // Update the price on all listings to be formatted as currency
        // Remove all non-numeric characters
        // Convert to a number
        const priceNumber = Number(price.replace(/[^0-9.]/g, ''));

        listing.price = priceNumber.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });

        if (priceNumber === 0) {
            listing.price = 'Open to Offers';
        }

        return listing;
    } catch (e) {
        listing.price = 'Open to Offers';
        return listing;
    }
}

function formatMRR(listing) {
    if (!listing.mrr) return listing;

    const mrrNumber = Number(listing.mrr.replace(/[^0-9.]/g, ''));

    if (mrrNumber === 0) {
        listing.mrr = null;
        return listing;
    } else if (mrrNumber < MRR_THRESHOLD) {
        listing.mrr = null;
        return listing;
    }

    listing.mrr = mrrNumber.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

    listing.mrr = `${listing.mrr} MRR`;

    return listing;
}


function getTimelineForCampaign(campaignCreationDate) {
    const startDate = subMonths(campaignCreationDate, settings.campaigns.emailListingsMonths);
    const endDate = campaignCreationDate;

    return { startDate, endDate };
}

async function getEmail(startDate, endDate) {
    const listings = await getListings(startDate, endDate);
    const minimumListingsPerEmail = 5;

    if (!listings.length || listings.length < minimumListingsPerEmail) {
        return null;
    }

    const shuffled = shuffle(listings);

    return {
        html: nunjucks.render('template.html', { listings: shuffled }),
        text: nunjucks.render('template.txt', { listings: shuffled }),
    };
}

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue,
        randomIndex;

    // While there pxain elements to shuffle...
    while (0 !== currentIndex) {
        // Pick a pxaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

async function getListing(_id) {
    return new Promise((resolve, reject) => {
        Listings.findOne({ _id }).exec(function (err, listing) {
            if (err) {
                reject(err);
            } else {
                if (!listing) return resolve(null);

                // Update the price on all listings to be formatted as currency
                listing = formatPrice(listing);

                // Update MRR format to $1,000.00 / month
                listing = formatMRR(listing);

                if (!listing.valuations) {
                    listing.valuations = [Number(listing.price.replace(/[^0-9.]/g, ''))];
                }

                resolve(listing);
            }
        });
    });
}

async function getListings(filters, sort) {
    return new Promise((resolve, reject) => {
        Listings
            .find(filters ? filters : {})
            .sort(sort ? sort : {})
            .exec(function (err, listings) {
                // Update the price on all listings to be formatted as currency
                listings = listings.map((listing) => formatPrice(listing));

                listings = listings.map((listing) => formatMRR(listing));

                if (err) {
                    reject(err);
                } else {
                    resolve(listings);
                }
            });
    });
}

function featuredListingsOnTop(listings) {
    // Separate featured and non-featured listings
    const featuredListings = listings.filter(listing => listing.featuredListing);
    const nonFeaturedListings = listings.filter(listing => !listing.featuredListing);

    // Sort featured listings to appear at the top
    const sortedListings = [...featuredListings, ...nonFeaturedListings];

    return sortedListings;
}

function revenueOnly(listings) {
    // Only show listings with MRR
    // MRR can be a string, so we need to extract the number, preserving the decimal
    // Update MRR format to $1,000.00 / month
    const filtered = listings.filter((listing) => {
        const mrr = listing.mrr;
        if (!mrr) return false;

        const mrrNumber = Number(mrr.replace(/[^0-9.]/g, ''));
        if (mrrNumber < MRR_THRESHOLD) return false;

        return true;
    });

    return featuredListingsOnTop(filtered);
}

function preRevenueOnly(listings) {
    // Only show listings with MRR
    // MRR can be a string, so we need to extract the number, preserving the decimal
    // Update MRR format to $1,000.00 / month
    const filtered = listings.filter((listing) => {
        const mrr = listing.mrr;
        if (!mrr) return true;

        const mrrNumber = Number(mrr.replace(/[^0-9.]/g, ''));
        if (!mrrNumber || mrrNumber < MRR_THRESHOLD) return true;

        return false;
    });

    return featuredListingsOnTop(filtered);
}

function isInteger(input) {
    // Check if the input is a number
    if (typeof input !== 'number') {
        return false;
    }

    // Check if the number is an integer
    return Number.isInteger(input);
}



module.exports = {
    error500,
    error404,

    getUser,

    featuredListingsOnTop,
    sortListings,
    formatPrice,
    formatMRR,
    revenueOnly,
    preRevenueOnly,

    getEmail,
    getListings,
    getTimelineForCampaign,
    shuffle,

    getListing,
    getListings,
    getUsers,

    isInteger
}