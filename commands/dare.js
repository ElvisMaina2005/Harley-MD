const dares = [
    "Sing your favourite song for 30 seconds.",
    "Dance without music for 30 seconds.",
    "Speak in a funny accent for the next 2 minutes.",
    "Do your best impression of a celebrity.",
    "Try to say a tongue twister three times quickly.",
    "Tell everyone a funny childhood story.",
    "Make up a short song about someone in the group.",
    "Talk like a news reporter for one minute.",
    "Do 10 jumping jacks.",
    "Draw a funny picture and show everyone.",
    "Pretend to be a robot for one minute.",
    "Say the alphabet backwards as far as you can.",
    "Make your funniest facial expression.",
    "Describe your day using only five words.",
    "Tell a joke without laughing.",
    "Act like your favourite animal for 30 seconds.",
    "Try to whistle your favourite song.",
    "Say three nice things about yourself.",
    "Make up a dance move and name it.",
    "Speak without using the letter A for one minute.",
    "Pretend you are accepting an award.",
    "Do your best evil laugh.",
    "Tell a story using three random words.",
    "Try to touch your nose with your tongue.",
    "Act like a teacher explaining something funny.",
    "Sing a song in a whisper.",
    "Talk like a cartoon character for one minute.",
    "Name five countries in ten seconds.",
    "Make up a funny nickname for yourself.",
    "Do your best runway walk.",
    "Pretend you are a radio presenter.",
    "Say a sentence in slow motion.",
    "Try to make everyone laugh in 30 seconds.",
    "Describe your favourite food dramatically.",
    "Act like you are walking on the moon.",
    "Give a motivational speech to a chair.",
    "Sing the chorus of a song you know.",
    "Try to rap for 30 seconds.",
    "Make a heart shape using your hands.",
    "Tell everyone your funniest harmless mistake.",
    "Pretend you are a sports commentator.",
    "Do five squats.",
    "Say a tongue twister while smiling.",
    "Describe yourself like a movie character.",
    "Act out a movie scene without speaking.",
    "Make up a funny advertisement for water.",
    "Speak like a king or queen for one minute.",
    "Try to balance on one foot for 20 seconds.",
    "Name ten animals in 15 seconds.",
    "Give an imaginary weather forecast.",
    "Pretend you are hosting a cooking show.",
    "Say something nice about the person who gave you this dare.",
    "Make a funny sound effect for everything you do for one minute.",
    "Try to sing a song using only humming.",
    "Describe your dream holiday dramatically.",
    "Act like you just won the lottery.",
    "Invent a new word and explain its meaning.",
    "Tell a short story in a dramatic voice.",
    "Pretend the floor is made of ice.",
    "Do your best impression of a teacher.",
    "Say five words that rhyme with cat.",
    "Give an imaginary pet a funny name.",
    "Try to make a serious face while telling a joke.",
    "Pretend you are giving a TED Talk about snacks.",
    "Describe your favourite movie without naming it.",
    "Make up a slogan for your name.",
    "Do a 20-second celebration dance.",
    "Speak like a pirate for one minute.",
    "Name five things you can see around you.",
    "Pretend to interview yourself.",
    "Act like a famous football commentator.",
    "Create a handshake with someone who agrees to join.",
    "Say a compliment to three people.",
    "Try to spell your name using movements.",
    "Make up a funny bedtime story.",
    "Pretend you are a tour guide showing an imaginary city.",
    "Sing a song as if you are very sleepy.",
    "Talk like a baby for 30 seconds.",
    "Do your best superhero pose.",
    "Explain how to make tea like a scientist.",
    "Make a funny face and hold it for 15 seconds.",
    "Name seven fruits in ten seconds.",
    "Pretend you are a detective solving a silly mystery.",
    "Create a short poem about friendship.",
    "Act like you are underwater for 30 seconds.",
    "Give yourself a dramatic introduction.",
    "Try to say your full name three times quickly.",
    "Pretend you are a famous chef reviewing plain water.",
    "Describe your favourite person using only positive words.",
    "Make up a funny excuse for being late.",
    "Do a slow-motion celebration.",
    "Imitate the sound of three different vehicles.",
    "Tell everyone what superpower you would choose.",
    "Pretend you are announcing breaking news.",
    "Say a sentence while keeping your tongue out.",
    "Make up a funny slogan for your group.",
    "Act like you are trying to sell an invisible phone.",
    "Give a one-minute speech about why sleep is important.",
    "Finish your turn with your best victory pose."
];

let previousDare = -1;

async function dareCommand(sock, chatId, message) {
    try {
        let index;

        do {
            index = Math.floor(Math.random() * dares.length);
        } while (dares.length > 1 && index === previousDare);

        previousDare = index;

        await sock.sendMessage(chatId, {
            text: `🔥 *DARE TIME!*\n\n${dares[index]}\n\n💪 _Complete the dare if you can!_`
        }, { quoted: message });
    } catch (error) {
        console.error('Error in dare command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Could not send a dare. Please try again.'
        }, { quoted: message });
    }
}

module.exports = { dareCommand };
