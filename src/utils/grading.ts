import { Question } from '../types';

export interface GradingResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
}

export function calculateCorrectness(question: Question, userAnswers: any): GradingResult | null {
  const { type, correct_options, score: maxScore = 1 } = question;
  
  if (type === 'essay' || type === 'big') {
    return null; // Cannot auto-grade
  }

  let parsedCorrect: any = null;
  try {
    parsedCorrect = typeof correct_options === 'string' ? JSON.parse(correct_options) : (correct_options || null);
  } catch (e) {
    return { isCorrect: false, score: 0, maxScore };
  }

  if (!parsedCorrect) return { isCorrect: false, score: 0, maxScore };

  if (type === 'single' || type === 'multiple') {
    const ua = Array.isArray(userAnswers) ? userAnswers : [];
    const ca = Array.isArray(parsedCorrect) ? parsedCorrect : [];
    if (ua.length !== ca.length) return { isCorrect: false, score: 0, maxScore };
    const sortedUa = [...ua].sort();
    const sortedCa = [...ca].sort();
    const isCorrect = sortedUa.every((val, index) => val === sortedCa[index]);
    return { isCorrect, score: isCorrect ? maxScore : 0, maxScore };
  }

  if (type === 'fishing') {
    // parsedCorrect is an array of ids. userAnswers is an object { [index]: id }
    if (!userAnswers || typeof userAnswers !== 'object') return { isCorrect: false, score: 0, maxScore };
    const ca = Array.isArray(parsedCorrect) ? parsedCorrect : [];
    if (ca.length === 0) return { isCorrect: false, score: 0, maxScore };
    
    let correctCount = 0;
    for (let i = 0; i < ca.length; i++) {
      if (userAnswers[i] === ca[i]) correctCount++;
    }
    const isCorrect = correctCount === ca.length;
    const score = (correctCount / ca.length) * maxScore;
    return { isCorrect, score, maxScore };
  }

  if (type === 'fill' || type === 'cloze') {
    if (!userAnswers || typeof userAnswers !== 'object') return { isCorrect: false, score: 0, maxScore };
    
    const content = question.content || '';
    const parts = content.split(/(\{[^{}]+\}|\{\{[^{}]+\}\})/g);
    
    const keyCounts: Record<string, number> = {};
    const doubleBraceCorrectness: Record<string, boolean[]> = {};
    const userAnswersByKey: Record<string, { val: string, index: number }[]> = {};
    const tempCounts: Record<string, number> = {};

    parts.forEach((part) => {
      if (part.match(/^\{\{.*?\}\}$/)) {
        const key = part.slice(2, -2);
        if (!userAnswersByKey[key]) userAnswersByKey[key] = [];
        const count = tempCounts[key] || 0;
        tempCounts[key] = count + 1;
        const uniqueKey = `${key}_${count}`;
        const val = userAnswers?.[uniqueKey] || userAnswers?.[key] || '';
        userAnswersByKey[key].push({ val, index: count });
      }
    });

    Object.keys(userAnswersByKey).forEach(key => {
      const answers = userAnswersByKey[key];
      const correctSet = parsedCorrect[key] || [];
      const correctArray = Array.isArray(correctSet) ? [...correctSet] : [correctSet];
      const results = new Array(answers.length).fill(false);
      
      answers.forEach((ans, i) => {
        const matchIdx = correctArray.findIndex(c => c === ans.val);
        if (matchIdx !== -1) {
          results[i] = true;
          correctArray.splice(matchIdx, 1);
        }
      });
      doubleBraceCorrectness[key] = results;
    });

    let totalBlanks = 0;
    let correctBlanks = 0;
    
    parts.forEach((part) => {
      const isDouble = part.startsWith('{{');
      const isSingle = part.startsWith('{') && !isDouble;
      
      if (isDouble || isSingle) {
        totalBlanks++;
        let inner = isDouble ? part.slice(2, -2) : part.slice(1, -1);
        let key = inner;
        if (inner.includes(':')) {
          key = inner.substring(0, inner.indexOf(':'));
        }

        const count = keyCounts[key] || 0;
        keyCounts[key] = count + 1;
        const uniqueKey = isDouble ? `${key}_${count}` : key;
        const currentVal = userAnswers?.[uniqueKey] || userAnswers?.[key] || '';

        const correctSet = parsedCorrect[key];
        let isCorrect = false;

        if (isDouble) {
          isCorrect = doubleBraceCorrectness[key]?.[count] || false;
        } else {
          const correctVal = Array.isArray(correctSet) ? correctSet[0] : correctSet;
          isCorrect = currentVal === correctVal;
        }

        if (isCorrect) {
          correctBlanks++;
        }
      }
    });
    
    if (totalBlanks === 0) return { isCorrect: false, score: 0, maxScore };
    
    const isCorrect = correctBlanks === totalBlanks;
    const score = (correctBlanks / totalBlanks) * maxScore;
    return { isCorrect, score, maxScore };
  }

  return { isCorrect: false, score: 0, maxScore };
}
