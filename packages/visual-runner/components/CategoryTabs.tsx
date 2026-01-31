import React from 'react';
import { Box, Text } from 'ink';

interface Props {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
}

export function CategoryTabs({ categories, selectedCategory }: Props) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>[←→] switch tabs: </Text>
      {categories.map((category, index) => {
        const isSelected = category === selectedCategory;
        return (
          <Box key={category} marginLeft={index > 0 ? 1 : 0}>
            <Text
              bold={isSelected}
              color={isSelected ? 'cyan' : undefined}
              dimColor={!isSelected}
            >
              {isSelected ? '▸ ' : '  '}
              {category}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
