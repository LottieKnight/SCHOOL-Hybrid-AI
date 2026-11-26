export const COMMUNITY_REACTION_TYPES = [
  "got_it",
  "same_question",
  "great_explanation",
  "saving_this",
  "exam_relevant",
  "kudos",
] as const;

export type CommunityReactionType = (typeof COMMUNITY_REACTION_TYPES)[number];

export type CommunityReactionCounts = Record<CommunityReactionType, number>;
export type CommunityQuestionFilter = "all" | "unanswered" | "my-modules" | "recent" | "for-you";

export type CommunityComment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorRole: string;
  authorUsername?: string | null;
  authorAvatar?: unknown;
  content: string;
  contentHtml?: string;
  createdAt: string;
  isAccepted: boolean;
  likeCount: number;
  userHasLiked: boolean;
};

export type CommunityPost = {
  id: string;
  userId: string;
  authorName: string;
  authorRole: string;
  authorUsername?: string | null;
  authorAvatar?: unknown;
  moduleCode: string;
  content: string;
  postType: "general" | "question" | "resource" | "announcement" | "poll";
  audience: "campus" | "faculty" | "module" | "public";
  imageUrls: string[];
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  reactionCounts: CommunityReactionCounts;
  activeReactions: CommunityReactionType[];
  comments: CommunityComment[];
  commentCount: number;
  acceptedAnswerId: string | null;
  sameQuestionCount: number;
  topContributorRank?: 1 | 2 | 3 | null;
  pollOptions?: string[] | null;
  pollVoteCounts?: number[] | null;
  pollUserVote?: number | null;
  pollTotalVotes?: number | null;
  contentHtml?: string;
  isPlaceholder?: boolean;
  isAnonymous: boolean;
};

export type CommunityExamCountdown = {
  subject: string;
  date: string;
  daysRemaining: number;
};

export type CommunityRoomListItem = {
  moduleCode: string;
  moduleName: string;
  postCount: number | null;
  hasLiveData: boolean;
  isStarter: boolean;
  isCampusLife?: boolean;
  activeNow?: boolean;
};

export type RelatedQuestion = {
  id: string;
  content: string;
  moduleCode: string;
  sameQuestionCount: number;
  commentCount: number;
  acceptedAnswerId: string | null;
};

export type CommunityRoomView = {
  moduleCode: string;
  moduleName: string;
  institutionName: string | null;
  institutionShortName: string | null;
  faculty: string | null;
  memberCount: number | null;
  sharedResourceCount: number | null;
  examCountdown: CommunityExamCountdown | null;
  answerRate: number | null;
  pinnedPost: CommunityPost | null;
  posts: CommunityPost[];
  hasLiveData: boolean;
};

export const CAMPUS_LIFE_ROOM_DEFINITIONS = [
  { code: "VARSITY-LIFE", name: "Varsity Life", audience: "campus" },
  { code: "FRESHERS", name: "Freshers", audience: "campus" },
  { code: "VARSITY-CUP", name: "Varsity Cup", audience: "public" },
  { code: "SOCIETIES", name: "Student Societies", audience: "campus" },
] as const;

export function isCampusLifeRoom(code: string | null | undefined) {
  const normalized = (code ?? "").trim().toUpperCase();
  return CAMPUS_LIFE_ROOM_DEFINITIONS.some((entry) => entry.code === normalized);
}

export function getCommunityRoomDisplayName(code: string | null | undefined) {
  const normalized = (code ?? "").trim().toUpperCase();
  const special = CAMPUS_LIFE_ROOM_DEFINITIONS.find((entry) => entry.code === normalized);
  if (special) return special.name;
  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.toUpperCase())
    .join(" ");
}

export function emptyReactionCounts(): CommunityReactionCounts {
  return {
    got_it: 0,
    same_question: 0,
    great_explanation: 0,
    saving_this: 0,
    exam_relevant: 0,
    kudos: 0,
  };
}

export function labelCommunityReaction(type: CommunityReactionType) {
  switch (type) {
    case "got_it":
      return "Like";
    case "same_question":
      return "Same question";
    case "great_explanation":
      return "Great explanation";
    case "saving_this":
      return "Saving this";
    case "exam_relevant":
      return "Exam relevant";
    case "kudos":
      return "Kudos";
    default:
      return type;
  }
}
