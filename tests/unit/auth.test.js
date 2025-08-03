import { validateToken, generateToken } from '../../src/utils/auth';
import jwt from 'jsonwebtoken';

describe('Authentication Utilities', () => {
  const mockUser = { id: 'user123', username: 'testuser' };
  const SECRET_KEY = process.env.JWT_SECRET;

  test('generates valid JWT token', () => {
    const token = generateToken(mockUser);
    const decoded = jwt.verify(token, SECRET_KEY);
    
    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.username).toBe(mockUser.username);
  });

  test('validates correct token', () => {
    const token = generateToken(mockUser);
    const result = validateToken(token);
    
    expect(result).toBeTruthy();
    expect(result.id).toBe(mockUser.id);
  });

  test('rejects expired token', () => {
    const expiredToken = jwt.sign(
      { id: mockUser.id, exp: Math.floor(Date.now() / 1000) - 60 }, 
      SECRET_KEY
    );
    
    expect(() => validateToken(expiredToken)).toThrow('jwt expired');
  });
});