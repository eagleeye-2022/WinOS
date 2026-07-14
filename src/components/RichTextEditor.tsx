"use client";

import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
    Essentials,
    Paragraph,
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Heading,
    List,
    ListProperties,
    TodoList,
    Link,
    Font,
    InlineEditor,
    BlockQuote,
    Table,
    TableToolbar,
    CodeBlock,
} from "ckeditor5";



import "ckeditor5/ckeditor5.css";

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
}

export default function RichTextEditor({
    value,
    onChange,
}: RichTextEditorProps) {
    return (
        <CKEditor
            editor={InlineEditor}
            data={value}
            config={{
                licenseKey: "GPL",

                plugins: [
                    Essentials,
                    Paragraph,
                    Bold,
                    Italic,
                    Underline,
                    Strikethrough,
                    Heading,
                    List,
                    ListProperties,
                    TodoList,
                    Link,
                    Font,
                    BlockQuote,
                    Table,
                    TableToolbar,
                    CodeBlock,
                ],

                toolbar: [
                    "bold",
                    "italic",
                    "underline",
                    "|",
                    "fontSize",
                    "|",
                    "bulletedList",
                    "numberedList",


                    "|",
                    "link",
                    "|",
                    "blockQuote",
                    "|",
                    "codeBlock",
                    "|",
                    "undo",
                    "redo",
                ],

                fontSize: {
                    options: [
                        10,
                        12,
                        14,
                        "default",
                        18,
                        20,
                        24,
                        30,
                        36,
                        48,
                    ],
                    supportAllValues: true,
                },

                table: {
                    contentToolbar: [
                        "tableColumn",
                        "tableRow",
                        "mergeTableCells",
                    ],
                },
            }}
            onChange={(_, editor) => {
                onChange(editor.getData());
            }}
        />
    );
}