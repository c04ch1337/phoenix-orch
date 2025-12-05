import React, { useId, useState, forwardRef, useRef, useImperativeHandle } from 'react';
import { FocusRing } from './FocusManager';
import { useAccessibility } from '../../context/AccessibilityContext';

// Types for form validation
export type ValidationRule = {
  test: (value: any) => boolean;
  message: string;
};

export type FormFieldError = string | null;

// Accessible Label component
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  error?: boolean;
  htmlFor: string;
  className?: string;
  srOnly?: boolean;
}

export const FormLabel: React.FC<LabelProps> = ({
  children,
  required,
  error,
  htmlFor,
  className = '',
  srOnly = false,
  ...props
}) => {
  const baseClasses = `block text-sm font-medium ${error ? 'text-red-600' : ''} ${srOnly ? 'sr-only' : ''}`;
  
  return (
    <label 
      htmlFor={htmlFor}
      className={`${baseClasses} ${className}`}
      {...props}
    >
      {children}
      {required && (
        <span className="ml-1 text-red-600" aria-hidden="true">*</span>
      )}
      {required && (
        <span className="sr-only"> (Required)</span>
      )}
    </label>
  );
};

// Error message component with ARIA support
interface ErrorMessageProps {
  id: string;
  message: string | null;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  id,
  message,
  className = ''
}) => {
  if (!message) return null;
  
  return (
    <div 
      id={id}
      className={`mt-1 text-sm text-red-600 ${className}`}
      aria-live="polite"
    >
      {message}
    </div>
  );
};

// Accessible Helper text component  
interface HelperTextProps {
  id: string;
  text: string;
  className?: string;
}

export const HelperText: React.FC<HelperTextProps> = ({
  id,
  text,
  className = ''
}) => {
  return (
    <p id={id} className={`mt-1 text-sm text-gray-500 ${className}`}>
      {text}
    </p>
  );
};

// Accessible Input component
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id?: string;
  label: string;
  error?: FormFieldError;
  helperText?: string;
  required?: boolean;
  hideLabel?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  errorClassName?: string;
  helperClassName?: string;
  validate?: (value: any) => FormFieldError;
  onValidate?: (isValid: boolean, value: any) => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id: propId,
  label,
  error,
  helperText,
  required = false,
  hideLabel = false,
  type = 'text',
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  inputClassName = '',
  errorClassName = '',
  helperClassName = '',
  validate,
  onValidate,
  onChange,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || `input-${generatedId}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const { preferences } = useAccessibility();
  const [internalError, setInternalError] = useState<FormFieldError>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Forward the ref to the input element
  useImperativeHandle(ref, () => inputRef.current!);

  // Combine external and internal errors
  const displayError = error || internalError;

  // Handle input change with validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Run validation if provided
    if (validate) {
      const validationError = validate(value);
      setInternalError(validationError);
      
      // Call onValidate callback if provided
      if (onValidate) {
        onValidate(!validationError, value);
      }
    }
    
    // Call the original onChange handler if provided
    if (onChange) {
      onChange(e);
    }
  };

  // Determine CSS classes based on state
  const inputBaseClasses = `block w-full px-4 py-2 border rounded-md focus:outline-none ${
    displayError 
      ? 'border-red-600 focus:border-red-600 focus:ring-2 focus:ring-red-600 focus:ring-opacity-50' 
      : 'border-gray-300 focus:border-phoenix-orange focus:ring-2 focus:ring-phoenix-orange focus:ring-opacity-50'
  }`;

  // High contrast mode classes
  const highContrastClasses = preferences.highContrastMode 
    ? 'border-2 border-solid focus:outline-4 focus:outline-offset-2' 
    : '';

  return (
    <div className={`mb-4 ${wrapperClassName}`}>
      <FormLabel 
        htmlFor={id} 
        required={required}
        error={!!displayError}
        className={labelClassName}
        srOnly={hideLabel}
      >
        {label}
      </FormLabel>
      
      <FocusRing>
        <input
          ref={inputRef}
          id={id}
          type={type}
          required={required}
          onChange={handleChange}
          aria-invalid={!!displayError}
          aria-describedby={`${displayError ? errorId : ''} ${helperText ? helperId : ''}`}
          className={`${inputBaseClasses} ${highContrastClasses} ${inputClassName} ${className}`}
          {...props}
        />
      </FocusRing>
      
      {displayError && (
        <ErrorMessage 
          id={errorId} 
          message={displayError} 
          className={errorClassName}
        />
      )}
      
      {helperText && !displayError && (
        <HelperText 
          id={helperId} 
          text={helperText} 
          className={helperClassName}
        />
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Accessible Textarea component
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id?: string;
  label: string;
  error?: FormFieldError;
  helperText?: string;
  required?: boolean;
  hideLabel?: boolean;
  wrapperClassName?: string;
  labelClassName?: string;
  textareaClassName?: string;
  errorClassName?: string;
  helperClassName?: string;
  validate?: (value: any) => FormFieldError;
  onValidate?: (isValid: boolean, value: any) => void;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  id: propId,
  label,
  error,
  helperText,
  required = false,
  hideLabel = false,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  textareaClassName = '',
  errorClassName = '',
  helperClassName = '',
  validate,
  onValidate,
  onChange,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || `textarea-${generatedId}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const { preferences } = useAccessibility();
  const [internalError, setInternalError] = useState<FormFieldError>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Forward the ref to the textarea element
  useImperativeHandle(ref, () => textareaRef.current!);

  // Combine external and internal errors
  const displayError = error || internalError;

  // Handle textarea change with validation
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Run validation if provided
    if (validate) {
      const validationError = validate(value);
      setInternalError(validationError);
      
      // Call onValidate callback if provided
      if (onValidate) {
        onValidate(!validationError, value);
      }
    }
    
    // Call the original onChange handler if provided
    if (onChange) {
      onChange(e);
    }
  };

  // Determine CSS classes based on state
  const textareaBaseClasses = `block w-full px-4 py-2 border rounded-md focus:outline-none ${
    displayError 
      ? 'border-red-600 focus:border-red-600 focus:ring-2 focus:ring-red-600 focus:ring-opacity-50'
      : 'border-gray-300 focus:border-phoenix-orange focus:ring-2 focus:ring-phoenix-orange focus:ring-opacity-50'
  }`;

  // High contrast mode classes
  const highContrastClasses = preferences.highContrastMode 
    ? 'border-2 border-solid focus:outline-4 focus:outline-offset-2'
    : '';

  return (
    <div className={`mb-4 ${wrapperClassName}`}>
      <FormLabel 
        htmlFor={id} 
        required={required} 
        error={!!displayError}
        className={labelClassName}
        srOnly={hideLabel}
      >
        {label}
      </FormLabel>
      
      <FocusRing>
        <textarea
          ref={textareaRef}
          id={id}
          required={required}
          onChange={handleChange}
          aria-invalid={!!displayError}
          aria-describedby={`${displayError ? errorId : ''} ${helperText ? helperId : ''}`}
          className={`${textareaBaseClasses} ${highContrastClasses} ${textareaClassName} ${className}`}
          {...props}
        />
      </FocusRing>
      
      {displayError && (
        <ErrorMessage 
          id={errorId} 
          message={displayError} 
          className={errorClassName}
        />
      )}
      
      {helperText && !displayError && (
        <HelperText 
          id={helperId} 
          text={helperText} 
          className={helperClassName}
        />
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

// Accessible Select component
interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  id?: string;
  label: string;
  options: SelectOption[];
  error?: FormFieldError;
  helperText?: string;
  required?: boolean;
  hideLabel?: boolean;
  emptyOption?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  selectClassName?: string;
  errorClassName?: string;
  helperClassName?: string;
  onChange?: (value: string, event: React.ChangeEvent<HTMLSelectElement>) => void;
  validate?: (value: any) => FormFieldError;
  onValidate?: (isValid: boolean, value: any) => void;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  id: propId,
  label,
  options,
  error,
  helperText,
  required = false,
  hideLabel = false,
  emptyOption,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  selectClassName = '',
  errorClassName = '',
  helperClassName = '',
  validate,
  onValidate,
  onChange,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || `select-${generatedId}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const { preferences } = useAccessibility();
  const [internalError, setInternalError] = useState<FormFieldError>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Forward the ref to the select element
  useImperativeHandle(ref, () => selectRef.current!);

  // Combine external and internal errors
  const displayError = error || internalError;

  // Handle select change with validation
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    // Run validation if provided
    if (validate) {
      const validationError = validate(value);
      setInternalError(validationError);
      
      // Call onValidate callback if provided
      if (onValidate) {
        onValidate(!validationError, value);
      }
    }
    
    // Call the original onChange handler if provided
    if (onChange) {
      onChange(value, e);
    }
  };

  // Determine CSS classes based on state
  const selectBaseClasses = `block w-full px-4 py-2 border rounded-md focus:outline-none appearance-none bg-no-repeat bg-right ${
    displayError 
      ? 'border-red-600 focus:border-red-600 focus:ring-2 focus:ring-red-600 focus:ring-opacity-50'
      : 'border-gray-300 focus:border-phoenix-orange focus:ring-2 focus:ring-phoenix-orange focus:ring-opacity-50'
  }`;

  // High contrast mode classes
  const highContrastClasses = preferences.highContrastMode 
    ? 'border-2 border-solid focus:outline-4 focus:outline-offset-2'
    : '';

  return (
    <div className={`mb-4 ${wrapperClassName}`}>
      <FormLabel 
        htmlFor={id} 
        required={required} 
        error={!!displayError}
        className={labelClassName}
        srOnly={hideLabel}
      >
        {label}
      </FormLabel>
      
      <div className="relative">
        <FocusRing>
          <select
            ref={selectRef}
            id={id}
            required={required}
            onChange={handleChange}
            aria-invalid={!!displayError}
            aria-describedby={`${displayError ? errorId : ''} ${helperText ? helperId : ''}`}
            className={`${selectBaseClasses} ${highContrastClasses} ${selectClassName} ${className}`}
            {...props}
          >
            {emptyOption && (
              <option value="">{emptyOption}</option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FocusRing>
        
        {/* Custom arrow indicator */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
      
      {displayError && (
        <ErrorMessage 
          id={errorId} 
          message={displayError} 
          className={errorClassName}
        />
      )}
      
      {helperText && !displayError && (
        <HelperText 
          id={helperId} 
          text={helperText} 
          className={helperClassName}
        />
      )}
    </div>
  );
});

Select.displayName = 'Select';

// Accessible Checkbox component
interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  id?: string;
  label: string;
  error?: FormFieldError;
  helperText?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  checkboxClassName?: string;
  errorClassName?: string;
  helperClassName?: string;
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  validate?: (value: boolean) => FormFieldError;
  onValidate?: (isValid: boolean, value: boolean) => void;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  id: propId,
  label,
  error,
  helperText,
  className = '',
  wrapperClassName = '',
  labelClassName = '',
  checkboxClassName = '',
  errorClassName = '',
  helperClassName = '',
  validate,
  onValidate,
  onChange,
  ...props
}, ref) => {
  const generatedId = useId();
  const id = propId || `checkbox-${generatedId}`;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const { preferences } = useAccessibility();
  const [internalError, setInternalError] = useState<FormFieldError>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Forward the ref to the checkbox element
  useImperativeHandle(ref, () => checkboxRef.current!);

  // Combine external and internal errors
  const displayError = error || internalError;

  // Handle checkbox change with validation
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    
    // Run validation if provided
    if (validate) {
      const validationError = validate(checked);
      setInternalError(validationError);
      
      // Call onValidate callback if provided
      if (onValidate) {
        onValidate(!validationError, checked);
      }
    }
    
    // Call the original onChange handler if provided
    if (onChange) {
      onChange(checked, e);
    }
  };

  // Determine CSS classes based on state
  const checkboxBaseClasses = `h-5 w-5 rounded focus:outline-none ${
    displayError
      ? 'border-red-600 focus:border-red-600 focus:ring-2 focus:ring-red-600 focus:ring-opacity-50'
      : 'border-gray-300 focus:border-phoenix-orange focus:ring-2 focus:ring-phoenix-orange focus:ring-opacity-50'
  }`;

  // High contrast mode classes
  const highContrastClasses = preferences.highContrastMode 
    ? 'border-2 border-solid focus:outline-4 focus:outline-offset-2'
    : '';

  return (
    <div className={`mb-4 ${wrapperClassName}`}>
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <FocusRing>
            <input
              ref={checkboxRef}
              id={id}
              type="checkbox"
              onChange={handleChange}
              aria-invalid={!!displayError}
              aria-describedby={`${displayError ? errorId : ''} ${helperText ? helperId : ''}`}
              className={`${checkboxBaseClasses} ${highContrastClasses} ${checkboxClassName} ${className}`}
              {...props}
            />
          </FocusRing>
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor={id} className={`font-medium ${displayError ? 'text-red-600' : ''} ${labelClassName}`}>
            {label}
          </label>
          {helperText && !displayError && (
            <p id={helperId} className={`text-gray-500 ${helperClassName}`}>
              {helperText}
            </p>
          )}
        </div>
      </div>
      
      {displayError && (
        <ErrorMessage 
          id={errorId} 
          message={displayError} 
          className={errorClassName}
        />
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

// Form component that provides context for form submission and validation
interface FormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> {
  onSubmit?: (event: React.FormEvent<HTMLFormElement>, isValid: boolean) => void;
  onValidationChange?: (isValid: boolean) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnSubmit?: boolean;
  className?: string;
}

export const Form: React.FC<FormProps> = ({
  children,
  onSubmit,
  onValidationChange,
  validateOnChange = true,
  validateOnBlur = true,
  validateOnSubmit = true,
  className = '',
  ...props
}) => {
  const [isValid, setIsValid] = useState(true);
  
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    // Prevent default browser submission
    event.preventDefault();
    
    // Perform native HTML validation
    const form = event.currentTarget;
    const formIsValid = form.checkValidity();
    
    // Update validation state
    setIsValid(formIsValid);
    
    // Call onValidationChange callback
    if (onValidationChange) {
      onValidationChange(formIsValid);
    }
    
    // Call onSubmit callback with validity state
    if (onSubmit) {
      onSubmit(event, formIsValid);
    }
  };
  
  return (
    <form
      onSubmit={handleSubmit}
      noValidate={validateOnSubmit} // Disable native validation if we're handling it ourselves
      className={className}
      {...props}
    >
      {children}
    </form>
  );
};

export default Form;