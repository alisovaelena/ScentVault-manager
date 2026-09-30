import React, { useEffect, useRef, useState } from 'react';

interface DecimalInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Field for money and volumes.
 *
 * A plain `type="number"` input refuses anything but whole numbers unless
 * `step` is set, and it silently clears itself when the decimal separator is a
 * comma — which is exactly what a Russian keyboard types. This keeps the typed
 * text locally, accepts both «,» and «.», and reports a number to the parent.
 */
const parseDecimal = (text: string): number => {
  const normalized = text.replace(',', '.').replace(/\s/g, '');
  if (normalized === '' || normalized === '.') return 0;
  const n = parseFloat(normalized);
  return isFinite(n) ? n : 0;
};

const DecimalInput: React.FC<DecimalInputProps> = ({ value, onChange, onFocus, onBlur, ...rest }) => {
  const [text, setText] = useState(() => String(value));
  const editing = useRef(false);

  // Follow the value when it changes from the outside (form reset, edit dialog).
  // While the typed text already means exactly this number it is left alone —
  // otherwise «196,5» would be rewritten to «196.5» under the user's fingers.
  useEffect(() => {
    if (parseDecimal(text) === value) return;
    setText(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={e => {
        editing.current = true;
        e.target.select(); // typing replaces the old amount instead of appending to it
        onFocus?.(e);
      }}
      onBlur={e => {
        editing.current = false;
        setText(String(parseDecimal(text))); // tidy «196,» → «196»
        onBlur?.(e);
      }}
      onChange={e => {
        // Keep only digits and a separator; no minus — these fields are never negative.
        const cleaned = e.target.value.replace(/[^\d.,]/g, '');
        setText(cleaned);
        onChange(parseDecimal(cleaned));
      }}
    />
  );
};

export default DecimalInput;
