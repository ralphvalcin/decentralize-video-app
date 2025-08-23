import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Room } from '../../src/components/Room';
import '@testing-library/jest-dom';

jest.mock('socket.io-client', () => {
  const emit = jest.fn();
  const on = jest.fn();
  return jest.fn(() => ({
    emit,
    on,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }));
});

describe('Room Component', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
    };
  });

  test('renders room component with initial state', () => {
    render(<Room socket={mockSocket} />);
    
    // Check for key UI elements
    expect(screen.getByTestId('video-grid')).toBeInTheDocument();
    expect(screen.getByTestId('audio-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('video-toggle')).toBeInTheDocument();
  });

  test('toggles audio state when audio button clicked', () => {
    render(<Room socket={mockSocket} />);
    
    const audioToggle = screen.getByTestId('audio-toggle');
    fireEvent.click(audioToggle);
    
    // Expect audio to be toggled (this is a simplified test)
    expect(audioToggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('emits socket events for room actions', () => {
    render(<Room socket={mockSocket} />);
    
    const shareButton = screen.getByTestId('share-room');
    fireEvent.click(shareButton);
    
    expect(mockSocket.emit).toHaveBeenCalledWith('generate-room-link');
  });
});