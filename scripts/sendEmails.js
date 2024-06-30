const { sendEmail } = require('../utils/email-api');
const { User, Session, Listings } = require('../models');
const { getListing } = require('../views/utils');
const { APP_URL } = require('../settings');

const listingId = 'ZXZDewiCQJZJvaQA';

const emailTemplate = (listing) => `
Hi there,

${listing.projectName} is now for sale on Borderline!

${listing.pitch}

Check out the listing here:
${APP_URL}/listing/${listing._id}

Tech used: ${listing.techUsed}

Price: $${listing.price} (or best offer/negotiable)
MRR: $${listing.mrr || 0}
`

async function sendEmails() {
    const listing = await getListing(listingId);
    console.log(emailTemplate(listing));
}

sendEmails({});