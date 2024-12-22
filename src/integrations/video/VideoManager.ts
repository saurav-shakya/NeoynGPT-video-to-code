import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import * as vscode from 'vscode';

export class VideoManager {
    private fileManager: GoogleAIFileManager;
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(apiKey: string) {
        this.fileManager = new GoogleAIFileManager(apiKey);
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });
    }

    async uploadVideo(filePath: string): Promise<any> {
        try {
            // Upload video file
            const uploadResponse = await this.fileManager.uploadFile(filePath, {
                mimeType: this.getMimeType(filePath),
                displayName: this.getFileName(filePath),
            });

            // Wait for processing
            let file = await this.fileManager.getFile(uploadResponse.file.name);
            while (file.state === FileState.PROCESSING) {
                await new Promise((resolve) => setTimeout(resolve, 10000));
                file = await this.fileManager.getFile(uploadResponse.file.name);
            }

            if (file.state === FileState.FAILED) {
                throw new Error("Video processing failed");
            }

            return file;
        } catch (error) {
            throw new Error(`Failed to upload video: ${error.message}`);
        }
    }

    async analyzeVideo(fileUri: string, prompt: string): Promise<string> {
        try {
            const result = await this.model.generateContent([
                {
                    fileData: {
                        mimeType: "video/mp4",
                        fileUri: fileUri
                    }
                },
                { text: prompt }
            ]);

            return result.response.text();
        } catch (error) {
            throw new Error(`Failed to analyze video: ${error.message}`);
        }
    }

    private getMimeType(filePath: string): string {
        const extension = filePath.split('.').pop()?.toLowerCase();
        const mimeTypes: { [key: string]: string } = {
            'mp4': 'video/mp4',
            'mpeg': 'video/mpeg',
            'mov': 'video/mov',
            'avi': 'video/avi',
            'flv': 'video/x-flv',
            'mpg': 'video/mpg',
            'webm': 'video/webm',
            'wmv': 'video/wmv',
            '3gp': 'video/3gpp'
        };
        return mimeTypes[extension || ''] || 'video/mp4';
    }

    private getFileName(filePath: string): string {
        return filePath.split(/[\\/]/).pop() || 'uploaded_video';
    }
} 