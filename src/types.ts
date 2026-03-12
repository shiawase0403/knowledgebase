export interface Subject {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  subject_id: string;
  title: string;
  type: 'A' | 'B';
  category?: string;
  created_at: string;
}

export type QuestionType = 'single' | 'multiple' | 'essay' | 'big' | 'fill' | 'cloze' | 'fishing';

export interface QuestionOption {
  id: string;
  content: string;
  image_url?: string;
}

export interface Question {
  id: string;
  task_id: string;
  parent_id?: string | null;
  type: QuestionType;
  content: string;
  image_url?: string; // JSON array of strings
  pdf_url?: string; // JSON array of strings
  ocr_text?: string;
  
  options?: string; // JSON string of QuestionOption[] or string[] (for fishing)
  correct_options?: string; // JSON string of string[] (IDs) or object (for fill/cloze)
  
  answer_content?: string;
  answer_image_url?: string; // JSON array of strings
  answer_pdf_url?: string; // JSON array of strings
  answer_ocr_text?: string;
  
  correct_count?: number;
  wrong_count?: number;
  is_marked?: number;
  score?: number;
  
  created_at: string;
  children?: Question[]; // For big questions
}

export interface Node {
  id: string;
  task_id: string;
  parent_id: string | null;
  content: string;
  image_url?: string;
  pdf_url?: string;
  ocr_text?: string;
  order_index: number;
  children?: Node[];
}

export type DefinitionType = 'index' | 'free';

export interface EntryDefinition {
  id: string;
  type: DefinitionType;
  meaning?: string; // For 'index' type
  example?: string; // For 'index' type
  content?: string; // For 'free' type
}

export interface DictionaryEntry {
  id: string;
  task_id: string;
  key: string;
  entries: string; // JSON string of EntryDefinition[]
  synonyms: string; // JSON string of string[] (keys)
  antonyms: string; // JSON string of string[] (keys)
  comparisons: string; // JSON string of string[] (keys)
  query_count: number;
  stars: number;
  review: string;
  created_at: string;
  updated_at: string;
}
