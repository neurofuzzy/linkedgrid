#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';

// Check if stdin supports raw mode
if (process.stdin.isTTY) {
  render(<App />);
} else {
  console.error('Error: This tool requires an interactive terminal.');
  console.error('Please run it directly in your terminal, not via npm run or piped commands.');
  process.exit(1);
}
