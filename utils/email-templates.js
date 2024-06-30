const { APP_URL } = require('../settings');

const newListing = (listing) => `
Hi there,

${listing.projectName} is now for sale on Borderline!

${listing.pitch}

Check out the listing here:
${APP_URL}/listing/${listing._id}

Tech used: ${listing.techUsed}

Price: ${listing.price} (or best offer/negotiable)
MRR: ${listing.mrr || 0}

PS: Please unsubscribe if you don't want to receive these emails.
`


const sellerCheckUp = (listing) => `
Hey,

Did you get any leads for ${listing.projectName}?

Quick link to your listing: ${APP_URL}/listing/${listing._id}

If not, please try this:

1. Share on Twitter/Linkedin
It's crazy but usually someone you know will buy it off of you.

2. Add supporting documents
Show how much traffic you're getting, revenue you've made or testimonials/positive feedback from customers.

3. Re-list at a lower price
It's a bit counterintuitive, but under priced listings end up in bidding wars and over priced listings scare off everyone. So if you're not getting any leads, try lowering the price.

To change your price or add documents, use this link to re-list ${APP_URL}/add-project/

You can reply to this email to ask me questions.

Good luck with the sale!

Thanks,
Kumail

PS: Please unsubscribe if you don't want these emails.
`;


const listingApproved = (listing) => `
Hi there,

${listing.projectName} has been approved!

Next steps:

1. Feature your listing to sell faster
${APP_URL}/feature-listing/${listing._id}

2. Share your listing on Twitter/Linkedin (someone you know might buy it off you)

3. If you're not getting enough leads in the first week, make sure you haven't made a pricing mistake
${APP_URL}/advice-for-sellers/

Link to your listing:
${APP_URL}/listing/${listing._id}

Thanks,
Kumail

PS: Please unsubscribe if you don't want to receive these emails.
`


const featureYourListing = (listing) => `
Hi there,

We just launched Featured Listings.

Feature ${listing.projectName} to get more views, leads and to sell faster.

Benefits:
- Your listing stays on top of the page (it gets "pinned")
- Gets Tweeted 3x more times by Borderline twitter account
- Gets emailed 2x to our newsletter subscibers
+ more

To feature your listing, go here:
${APP_URL}/feature-listing/${listing._id}

Thanks,
Kumail

PS: Please unsubscribe if you don't want to receive these emails.
`



const rejectReason = (listing, reason) => `
Hi there,

Your listing ${listing.projectName} cannot go live on Borderline.

The reason is:
${reason}

If you have any questions or think this is a mistake, you can reply to this email and we'll have a look.

Thanks,
Kumail

PS: Please unsubscribe if you don't want to receive these emails.
`


module.exports = {
    templates: {
        newListing,
        sellerCheckUp,
        listingApproved,
        featureYourListing,
        rejectReason,
    }
}