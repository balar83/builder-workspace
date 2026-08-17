import type { QuestionType, ResponseSpecification } from '../types/question';
import AnswerInput from './AnswerInput';
import SingleChoiceInput from './SingleChoiceInput';
import MultiChoiceInput from './MultiChoiceInput';

export interface QuestionResponseInputProps {
  questionType: QuestionType;
  responseSpecification: ResponseSpecification | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

// The one place either question page decides how to render a response -
// neither QuestionPage nor SessionQuestionPage branches on questionType
// itself. Falls back to the free-text AnswerInput for any type without a
// dedicated component (every type except single_choice/multi_choice
// today), which is what already keeps every existing question working
// unchanged: legacy questions never carry a questionType other than
// "short_text"/"numeric", both of which resolve here.
export default function QuestionResponseInput({
  questionType,
  responseSpecification,
  value,
  onChange,
  onSubmit,
  disabled = false,
}: QuestionResponseInputProps) {
  if (questionType === 'single_choice' && responseSpecification?.options) {
    return (
      <SingleChoiceInput
        options={responseSpecification.options}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  if (questionType === 'multi_choice' && responseSpecification?.options) {
    return (
      <MultiChoiceInput
        options={responseSpecification.options}
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        disabled={disabled}
      />
    );
  }

  return <AnswerInput value={value} onChange={onChange} onSubmit={onSubmit} disabled={disabled} />;
}
