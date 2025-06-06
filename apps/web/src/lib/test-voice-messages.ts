import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

export interface VoiceMessage {
  content: string;
  timestamp: number;
  speaker: "user" | "AI";
}

// Test voice messages for development - Ghost Writing Interview
export const testVoiceMessages: VoiceMessage[] = [
  {
    content: "Hey there. What can I help you write today?",
    timestamp: Date.now() - 1000 * 60 * 30,
    speaker: "AI"
  },
  {
    content: "I wanna write a blog post about how I explored the OpenAI Canvas product and have thought of some new UX models and also a brand new product idea that came out of it.",
    timestamp: Date.now() - 1000 * 60 * 29,
    speaker: "user"
  },
  {
    content: "That sounds really interesting. What stage are you at with this blog post? Do you have some notes or just brainstorming ideas?",
    timestamp: Date.now() - 1000 * 60 * 28,
    speaker: "AI"
  },
  {
    content: "I don't really have too many notes yet.",
    timestamp: Date.now() - 1000 * 60 * 27,
    speaker: "user"
  },
  {
    content: "No problem. What's your overall goal for this blog post? Are you looking to share insights, spark discussion, or maybe pitch your new product idea?",
    timestamp: Date.now() - 1000 * 60 * 26,
    speaker: "AI"
  },
  {
    content: "Basically, I want to get as much interest, uh, online as possible. So I want it to be really catchy. Because I'm trying to basically use this as a way to boost my job application for a company that has a similar product.",
    timestamp: Date.now() - 1000 * 60 * 25,
    speaker: "user"
  },
  {
    content: "Got it. So you're aiming for a catchy post that showcases your insights and ideas to attract attention. What specific aspects of the OpenAI Canvas product did you find most intriguing or inspiring?",
    timestamp: Date.now() - 1000 * 60 * 24,
    speaker: "AI"
  },
  {
    content: "Well, basically, think a lot of these Canvas products are all very similar. Right? They they have, like, a chat on the left and a document on the right. They're kind of useful, I think, as gimmicks a little bit. Like, they help you maybe write a poem or something really fast. But I think the main problem with them is that they don't really help you come up with what you wanna write in the first place.",
    timestamp: Date.now() - 1000 * 60 * 23,
    speaker: "user"
  },
  {
    content: "That's an interesting perspective. So you're saying they lack the ability to help users generate ideas before jumping into writing. How do you envision your new UX models addressing this gap?",
    timestamp: Date.now() - 1000 * 60 * 22,
    speaker: "AI"
  },
  {
    content: "Well, I'm working on a new voice based ghostwriting assistant. I was inspired by a friend who, as a at a VC firm, they basically have a ghost writer And the ghostwriter will basically interview the person for, like, an hour and then write the post for them. Which I think is a really nice model because that way, you know, you can kinda get all your thoughts out A good interviewer can kind of ask good probing questions and can help you you know, figure out more what you wanna write. And then they can actually take it, you know, all the rest of the way from there, is what I think AI has the potential to actually do.",
    timestamp: Date.now() - 1000 * 60 * 21,
    speaker: "user"
  },
  {
    content: "That sounds like a fantastic idea. A voice based ghostwriting assistant could really enhance the creative process by guiding users through their thoughts. What unique features do you think this assistant should have to stand out from existing tools?",
    timestamp: Date.now() - 1000 * 60 * 20,
    speaker: "AI"
  },
  {
    content: "I mean, that's that's the main feature. It's based gonna have, like, a a voice assistant that will take notes. So as you talk, the notes will kinda be populated. And the notes will then be what turns into the actual prompt. That will be used to generate the the actual draft so there will be kind of a note taking UX in addition to the voice UX.",
    timestamp: Date.now() - 1000 * 60 * 19,
    speaker: "user"
  },
  {
    content: "I love that concept. Combining voice interaction with a note taking feature could really streamline the writing process. How do you plan to present this idea in your blog post to capture your audience's attention?",
    timestamp: Date.now() - 1000 * 60 * 18,
    speaker: "AI"
  },
  {
    content: "I don't know. I mean, I I could use some suggestions. What do you think? I mean, I wanna be very visual. So I'll definitely have some demos and videos. But I just I I care so much about the first few sentences of the blog post because that's really what's gonna either catch people's attention or not.",
    timestamp: Date.now() - 1000 * 60 * 17,
    speaker: "user"
  },
  {
    content: "Absolutely. The opening lines are crucial. You might start with a compelling question or a bold statement. About the limitations of current Canvas products. What if you framed it around idea of transforming the way we brainstorm and write? Would that resonate with your vision?",
    timestamp: Date.now() - 1000 * 60 * 16,
    speaker: "AI"
  },
  {
    content: "I think so. I mean, to me, what I think is really important is, like, you know, the main thing I'm interviewing for a role about Canvas. And Canvas, think most people view as a writing assistant. So I think I I don't know if a lot of people know what these Canvas products are. They don't I feel like they're all all treated as kind of a sub kind of, uh, feature of the main assistance So on the 1 hand, I'm tempted to say, like, hey. There's a big problem with Canvas products today. They don't solve x y z problem. But I don't know if the average person will really know what I'm talking about if I say Canvas product. Yeah. I don't know. What do you think?",
    timestamp: Date.now() - 1000 * 60 * 15,
    speaker: "user"
  },
  {
    content: "That's That's a valid point. You might wanna introduce the concept of Canvas products briefly before diving into the problems they face. Something like in the age of AI writing assistants, many tools are branded as Canvas products, but they often miss the mark. In helping users generate ideas. This way, you educate your readers while highlighting the issue. Does that approach resonate with you?",
    timestamp: Date.now() - 1000 * 60 * 14,
    speaker: "AI"
  },
  {
    content: "Yeah. I think I could see that. Yeah. Maybe I can also try to catch",
    timestamp: Date.now() - 1000 * 60 * 13,
    speaker: "user"
  },
  {
    content: "Great.",
    timestamp: Date.now() - 1000 * 60 * 12,
    speaker: "AI"
  },
  {
    content: "some attention by just noting how many different Canvas products there are. I also so here's another idea I have, though. Another idea is, comparing this to vibe coding. Which has a lot more awareness and attraction right now. Think there are some good vibe coding apps, but there aren't really good vibe writing apps And I think there's the big the big I have this so I have this theory about why there's a big difference. Let me know if this makes sense. When I'm live coding, I can basically try some code and then see does this work. Right? Um, does this",
    timestamp: Date.now() - 1000 * 60 * 11,
    speaker: "user"
  },
  {
    content: "That makes",
    timestamp: Date.now() - 1000 * 60 * 10,
    speaker: "AI"
  },
  {
    content: "does the code actually accomplish what I want? And that is very objective. Right? So I can just keep trying things, and I don't really need to see all of the content. That it's generating. Because if it works, it works. But with writing, it's not the same. Right? Like, if it generates a whole page of content, I don't really know if that content is good or not. Until I actually read through it all, which takes a lot of time. So I do think the the vibe writing kind of case is maybe a more difficult case than Vibe coding. And I don't know. Maybe there's something there I can use to draw people in because vibe is really popular these days.",
    timestamp: Date.now() - 1000 * 60 * 9,
    speaker: "user"
  },
  {
    content: "That's a fascinating comparison. Highlighting the differences between live coding and writing. Could definitely draw readers in. Especially if you connect it to the challenges of evaluating written content. You might consider framing it as a call to action for creating better tools for writers just like vibe coding has evolved. Does that direction feel right to you?",
    timestamp: Date.now() - 1000 * 60 * 8,
    speaker: "AI"
  },
  {
    content: "I think so. I mean, let's note this down as 1 idea. The 1 challenge with this idea is, basically, that you know, I think the main challenge is that this theory I have about vibe coding and writing doesn't necessarily tie directly into the I don't know. It doesn't tie directly into my UX of, like, getting help from a voice assistant. Uh, that's those are kinda 2 different topics a little bit.",
    timestamp: Date.now() - 1000 * 60 * 7,
    speaker: "user"
  },
  {
    content: "That's a good observation. So you might wanna consider how to bridge those 2 ideas. Maybe you can use the vibe coding analogy to emphasize the need for more interactive writing tools. Leading into your voice assistant concept as a solution. Would that help create a cohesive flow in your post?",
    timestamp: Date.now() - 1000 * 60 * 6,
    speaker: "AI"
  },
  {
    content: "It could. Yeah. Actually, this makes me think, like, I think, basically, with writing, it makes sense to iterate at the kind of outline levels more. Which is how my app will work. As you talk to the assistant, it will be generating an outline with a bunch of notes These would be kinda like the ghostwriter's notes, and it would know, propose different you know, catchy phrases in the beginning, would propose different structures of the overall document. And it would also have lots of content. But it does it and it's used more useful to iterate on that format and then generate the post from that in the future rather than to actually generate the entire document over and over and over. Right? Like, that makes it hard to iterate. When if you just write a whole blog post and then you know, you say, hey. Make some changes, and then you get a whole new blog post It's just very slow. Right? It's like you have to read the entire document. It's really long. So I do think what my product helps you do is basically it helps you iterate in that kind of outline format. Which is a lot more useful than iterating in the the full document format.",
    timestamp: Date.now() - 1000 * 60 * 5,
    speaker: "user"
  }
];

// Convert a voice message to a LangChain message
export function convertToLangChainMessage(message: VoiceMessage) {
  if (message.speaker === "user") {
    return new HumanMessage({
      content: message.content,
      id: uuidv4(),
      additional_kwargs: {
        isVoiceMessage: true,
        timestamp: message.timestamp,
        displaySpeaker: "user"
      }
    });
  } else {
    return new AIMessage({
      content: message.content,
      id: uuidv4(),
      additional_kwargs: {
        isVoiceMessage: true,
        timestamp: message.timestamp,
        displaySpeaker: "AI"
      }
    });
  }
}

// Get the next message in sequence
export function getNextMessage(currentIndex: number): VoiceMessage | null {
  if (currentIndex >= testVoiceMessages.length - 1) {
    return null;
  }
  return testVoiceMessages[currentIndex + 1];
}

// Get all messages up to a certain index
export function getMessagesUpTo(index: number): VoiceMessage[] {
  return testVoiceMessages.slice(0, index + 1);
} 