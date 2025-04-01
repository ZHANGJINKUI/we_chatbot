"use client";

import { Box, Heading, Text, Button, Flex, Link } from '@chakra-ui/react';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';

interface ResultDisplayProps {
  content: string;
  onReset: () => void;
}

export default function ResultDisplay({ content, onReset }: ResultDisplayProps) {
  return (
    <Box borderRadius="md" border="1px" borderColor="gray.200" p={6}>
      <Heading as="h2" size="md" mb={4}>处理结果</Heading>
      
      <Box 
        bg="gray.50" 
        p={4} 
        borderRadius="md" 
        whiteSpace="pre-wrap"
        maxHeight="400px"
        overflowY="auto"
        mb={6}
      >
        <Text>{content}</Text>
      </Box>
      
      <Flex gap={4} justifyContent="center">
        <Link 
          href="http://localhost:8000/api/download-result" 
          _hover={{ textDecoration: 'none' }}
          isExternal
        >
          <Button
            leftIcon={<FiDownload />}
            colorScheme="blue"
          >
            下载处理后文档
          </Button>
        </Link>
        
        <Button
          onClick={onReset}
          colorScheme="green"
          leftIcon={<FiRefreshCw />}
        >
          上传新文档
        </Button>
      </Flex>
    </Box>
  );
} 