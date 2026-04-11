import { render } from '@testing-library/react';
import Home from './index';
import '@testing-library/jest-dom';

describe('Home Page', () => {
  test('renders the welcome message', () => {
    const { getByText } = render(<Home />);
    const welcomeElement = getByText(/Welcome to the Recycle-AI/i);
    expect(welcomeElement).toBeInTheDocument();
  });
});