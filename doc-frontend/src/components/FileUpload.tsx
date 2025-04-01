"use client";

import { useState, useRef } from 'react';
import { 
  Box, Button, Text, VStack, 
  useToast, Progress
} from '@chakra-ui/react';
import { FiUpload } from 'react-icons/fi';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export default function FileUpload({ onFileSelect, isLoading }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.docx')) {
      toast({
        title: '格式错误',
        description: '只支持.docx格式文件',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setSelectedFile(file);
    onFileSelect(file);
  };

  return (
    <Box width="100%">
      <Box
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        border="2px dashed"
        borderColor={dragActive ? 'blue.400' : 'gray.200'}
        borderRadius="md"
        p={6}
        textAlign="center"
        bg={dragActive ? 'blue.50' : 'transparent'}
        transition="all 0.3s ease"
      >
        <VStack spacing={4}>
          <FiUpload size={48} color="#A0AEC0" />
          <Text fontSize="lg" color="gray.500">
            拖拽文件到这里或点击上传
          </Text>
          <Button
            colorScheme="blue"
            onClick={() => inputRef.current?.click()}
            isDisabled={isLoading}
          >
            选择文件
          </Button>
          <input
            type="file"
            onChange={handleFileSelect}
            ref={inputRef}
            style={{ display: 'none' }}
            accept=".docx"
          />
        </VStack>
      </Box>
      
      {selectedFile && (
        <Box mt={4} p={3} borderRadius="md" bg="gray.50">
          <Text fontWeight="bold">已选择文件:</Text>
          <Text>{selectedFile.name} ({formatFileSize(selectedFile.size)})</Text>
        </Box>
      )}
      
      {isLoading && <Progress size="xs" isIndeterminate mt={4} colorScheme="blue" />}
    </Box>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
  else return (bytes / 1048576).toFixed(2) + ' MB';
} 