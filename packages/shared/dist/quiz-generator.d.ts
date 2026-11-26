export declare function generateQuiz(extractedText: string, grade: number): {
    questions: {
        type: "mcq" | "short_answer" | "true_false";
        id: string;
        prompt: string;
        answer: string;
        explanation: string;
        difficulty: "easy" | "medium" | "hard";
        tags: string[];
        options?: string[] | undefined;
    }[];
};
//# sourceMappingURL=quiz-generator.d.ts.map