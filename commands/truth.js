const questions = [
    "What is the biggest secret you have ever kept?",
    "Who was your first crush?",
    "What is the most embarrassing thing that has happened to you?",
    "Have you ever lied to your best friend?",
    "What is one thing you wish people knew about you?",
    "What is your biggest fear?",
    "Have you ever pretended to like someone?",
    "What is the strangest dream you have ever had?",
    "Who do you trust the most?",
    "What is one thing you regret doing?",
    "Have you ever had a crush on a friend's partner?",
    "What is the biggest lie you have ever told?",
    "What is something you have never told your parents?",
    "When was the last time you cried?",
    "What is your most embarrassing nickname?",
    "Have you ever sent a message to the wrong person?",
    "What is the funniest thing you have done in public?",
    "What is one habit you want to change?",
    "Have you ever blamed someone else for your mistake?",
    "What is the most childish thing you still do?",
    "Who was the last person you searched for on social media?",
    "Have you ever stalked someone's profile secretly?",
    "What is the weirdest thing you do when you are alone?",
    "What is your biggest insecurity?",
    "Have you ever broken someone's heart?",
    "What is the longest you have gone without showering?",
    "What is something you are jealous of?",
    "Have you ever faked being sick to avoid something?",
    "What is the most expensive thing you have damaged?",
    "What is your biggest turn-off?",
    "If you could change one decision, what would it be?",
    "What is the most awkward date you have ever had?",
    "Have you ever fallen in love at first sight?",
    "What is your idea of a perfect relationship?",
    "Who was your first kiss?",
    "Have you ever liked two people at the same time?",
    "What makes you instantly attracted to someone?",
    "Would you date someone your friends dislike?",
    "What is the sweetest thing someone has done for you?",
    "Have you ever hidden a relationship from your friends?",
    "What is one thing you find difficult to admit?",
    "What is the most ridiculous thing you have argued about?",
    "Have you ever laughed at a serious moment?",
    "What is your funniest childhood memory?",
    "What is the weirdest food combination you enjoy?",
    "If you became famous, what would it be for?",
    "What is the strangest thing in your search history?",
    "Have you ever talked to yourself in a mirror?",
    "What is the funniest excuse you have ever used?",
    "What is one silly thing that scares you?",
    "Who in this group makes you laugh the most?",
    "Who in this group would you trust with a secret?",
    "Who in this group knows you best?",
    "Who in this group would survive longest on a deserted island?",
    "Who in this group is most likely to become famous?",
    "Who in this group gives the best advice?",
    "Who in this group is the funniest?",
    "Who in this group would you choose as a travel partner?",
    "What was your first impression of this group?",
    "Who in this group would you call first in an emergency?",
    "What is one thing you wish you could say without consequences?",
    "What is the most awkward message you have received?",
    "Have you ever pretended not to see someone's message?",
    "What is the last thing you searched online?",
    "What is one thing you would never post online?",
    "Have you ever had a crush on someone in this group?",
    "What is the most trouble you have ever been in?",
    "What is one promise you failed to keep?",
    "Have you ever stolen something, even something small?",
    "What is the worst gift you have ever received?",
    "What is something you are proud of but rarely mention?",
    "What is one thing you wish you were better at?",
    "What is your biggest personal goal?",
    "What is the hardest lesson life has taught you?",
    "What do you pretend not to care about but actually do?",
    "What is one thing you would change about your past?",
    "Have you ever judged someone and later regretted it?",
    "What is the kindest thing you have ever done?",
    "What is one thing you cannot forgive easily?",
    "What makes you feel appreciated?",
    "What is your biggest relationship fear?",
    "Have you ever been caught lying?",
    "What is the most awkward compliment you have received?",
    "What is one thing you would do if nobody judged you?",
    "What is the funniest rumor you have heard about yourself?",
    "What is something you are secretly good at?",
    "What is your most unusual talent?",
    "What is one thing you wish you could tell your younger self?",
    "What is the most spontaneous thing you have ever done?",
    "What is your biggest pet peeve?",
    "Have you ever regretted sending a text immediately?",
    "What is one thing that instantly improves your mood?",
    "If you could read one person's mind for a day, whose would it be?",
    "What is one question you hope nobody asks you?",
    "What is the most memorable moment of your life?",
    "What is one thing you value most in friendship?",
    "Have you ever kept a gift you disliked and pretended to love it?",
    "What is one truth about yourself that surprises people?"
];

let previousQuestion = -1;

async function truthCommand(sock, chatId, message) {
    try {
        let index;

        do {
            index = Math.floor(Math.random() * questions.length);
        } while (questions.length > 1 && index === previousQuestion);

        previousQuestion = index;

        await sock.sendMessage(chatId, {
            text: `🧐 *TRUTH TIME!*\n\n${questions[index]}\n\n_Answer honestly!_`
        }, { quoted: message });
    } catch (error) {
        console.error('Error in truth command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Could not send a truth question. Please try again.'
        }, { quoted: message });
    }
}

module.exports = { truthCommand };
