const postmark = require("postmark");
const client = new postmark.ServerClient(process.env.POSTMARK_SERVER);

function sendEmail(
    subject,
    text,
    to,
    from = 'contact@borderline.biz',
    replyTo = 'contact@borderline.biz',
) {
    try {
        client.sendEmail({
            "From": from,
            "To": to,
            "Subject": subject,
            "ReplyTo": replyTo,
            "HtmlBody": `<pre style="font-family: sans-serif; font-size: 15px; color: #334155">${text}</pre>`,
            "TextBody": text,
            "MessageStream": "broadcast"
        })
        .then((response) => {
            console.log("Email sent successfully:", response);
        })
        .catch((error) => {
            console.error("Unhandled promise rejection:", error);
        });
    } catch (e) {
        console.error("An error occurred:", e);
    }
}

module.exports = {
    sendEmail,
};
