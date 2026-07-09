import type { Question } from '../types/question';

const questions: Question[] = [
  {
    id: 'q1-rational-numbers',
    chapterId: 'rational-numbers',
    text: 'What is the result of adding 1/3 and 1/6?',
    difficulty: 'Easy',
    hints: ['Find common denominator, then add numerators.'],
  },
  {
    id: 'q1-linear-equations',
    chapterId: 'linear-equations',
    text: 'Solve for x: 2x + 3 = 11.',
    difficulty: 'Easy',
    hints: ['Subtract 3 from both sides, then divide by 2.'],
  },
  {
    id: 'q1-understanding-quadrilaterals',
    chapterId: 'understanding-quadrilaterals',
    text: 'What is a property of a parallelogram?',
    difficulty: 'Medium',
    hints: ['Opposite sides are parallel and equal in length.'],
  },
  {
    id: 'q1-practical-geometry',
    chapterId: 'practical-geometry',
    text: 'Which instrument is used to draw arcs of circle?',
    difficulty: 'Easy',
    hints: ['Use a compass to draw arcs and circles.'],
  },
  {
    id: 'q1-data-handling',
    chapterId: 'data-handling',
    text: 'What is the mean of the numbers 2, 4, 6, 8?',
    difficulty: 'Medium',
    hints: ['Add them and divide by the count (4).'],
  },
];

export default questions;
