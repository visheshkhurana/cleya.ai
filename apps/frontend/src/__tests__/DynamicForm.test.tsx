import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DynamicForm } from '@/components/forms/DynamicForm';

describe('DynamicForm', () => {
  it('renders labels and required marker', () => {
    render(
      <DynamicForm
        fields={[
          { name: 'name', type: 'text', label: 'Full Name', required: true },
          { name: 'bio', type: 'textarea', label: 'Bio' },
        ]}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('Full Name')).toBeInTheDocument();
    expect(screen.getByText('Bio')).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('submits text values', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'name', type: 'text', label: 'Name', required: true }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada' });
  });

  it('shows required-field error and blocks submit', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'name', type: 'text', label: 'Name', required: true }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clears the error once the field is edited', () => {
    render(
      <DynamicForm
        fields={[{ name: 'name', type: 'text', label: 'Name', required: true }]}
        onSubmit={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'A' },
    });
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  });

  it('validates email format', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'email', type: 'email', label: 'Email' }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a valid email', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'email', type: 'email', label: 'Email' }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'a@b.co' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co' });
  });

  it('validates URL fields (non-linkedin)', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'website', type: 'url', label: 'Website' }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'not a url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText('Invalid URL')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('enforces max length validation', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[
          {
            name: 'name',
            type: 'text',
            label: 'Name',
            validation: { max: 5 },
          },
        ]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'too long' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText('Max 5 characters')).toBeInTheDocument();
  });

  it('renders a select and submits the chosen value', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[
          {
            name: 'role',
            type: 'select',
            label: 'Role',
            options: [
              { label: 'Engineer', value: 'eng' },
              { label: 'Designer', value: 'dsg' },
            ],
          },
        ]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByText('Select...'));
    fireEvent.click(screen.getByText('Designer'));
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({ role: 'dsg' });
  });

  it('multiselect toggles values on/off', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[
          {
            name: 'tags',
            type: 'multiselect',
            label: 'Tags',
            options: [
              { label: 'Red', value: 'red' },
              { label: 'Blue', value: 'blue' },
            ],
          },
        ]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByText('Red'));
    fireEvent.click(screen.getByText('Blue'));
    fireEvent.click(screen.getByText('Red')); // toggle off
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({ tags: ['blue'] });
  });

  it('multiselect "other" lets user add custom value', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[
          {
            name: 'tags',
            type: 'multiselect',
            label: 'Tags',
            options: [
              { label: 'Red', value: 'red' },
              { label: 'Other', value: 'other' },
            ],
          },
        ]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByText('Other'));
    const customInput = screen.getByPlaceholderText('Enter custom tags');
    fireEvent.change(customInput, { target: { value: 'Purple Haze' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({ tags: ['purple_haze'] });
  });

  it('hides conditional fields when condition is not met', () => {
    render(
      <DynamicForm
        fields={[
          {
            name: 'hasJob',
            type: 'select',
            label: 'Employed',
            options: [
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          },
          {
            name: 'company',
            type: 'text',
            label: 'Company',
            conditional: { field: 'hasJob', value: 'yes' },
          },
        ]}
        onSubmit={() => {}}
      />,
    );
    expect(screen.queryByText('Company')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Select...'));
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByText('Company')).toBeInTheDocument();
  });

  it('skips required check for hidden conditional field', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[
          {
            name: 'hasJob',
            type: 'select',
            label: 'Employed',
            options: [
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' },
            ],
          },
          {
            name: 'company',
            type: 'text',
            label: 'Company',
            required: true,
            conditional: { field: 'hasJob', value: 'yes' },
          },
        ]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByText('Select...'));
    fireEvent.click(screen.getByText('No'));
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({ hasJob: 'no' });
  });

  it('linkedinUrl: typing a slug normalizes to full URL on submit', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[
          { name: 'linkedinUrl', type: 'url', label: 'LinkedIn' },
        ]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('your-profile'), {
      target: { value: 'ada-lovelace' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      linkedinUrl: 'https://linkedin.com/in/ada-lovelace',
    });
  });

  it('linkedinUrl: pasting a full URL extracts the slug', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[
          { name: 'linkedinUrl', type: 'url', label: 'LinkedIn' },
        ]}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByPlaceholderText('your-profile') as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'https://www.linkedin.com/in/ada-lovelace/' },
    });
    expect(input.value).toBe('ada-lovelace');
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({
      linkedinUrl: 'https://linkedin.com/in/ada-lovelace',
    });
  });

  it('renders a phone field and validates it', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'phone', type: 'phone', label: 'Phone' }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(
      screen.getByText(/valid India phone number/),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid phone number', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'phone', type: 'phone', label: 'Phone' }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '9876543210' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).toHaveBeenCalledWith({ phone: '+919876543210' });
  });

  it('disables submit and changes label after successful submit', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'name', type: 'text', label: 'Name' }]}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Ada' },
    });
    const submit = screen.getByRole('button', { name: /Continue/ });
    fireEvent.click(submit);
    const submittedBtn = screen.getByRole('button', { name: /Submitted/ });
    expect(submittedBtn).toBeDisabled();
    fireEvent.click(submittedBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('honours the disabled prop (no submission)', () => {
    const onSubmit = vi.fn();
    render(
      <DynamicForm
        fields={[{ name: 'name', type: 'text', label: 'Name' }]}
        onSubmit={onSubmit}
        disabled
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
