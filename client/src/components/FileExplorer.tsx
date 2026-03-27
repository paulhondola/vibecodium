import { useState } from "react";
import { FileCode, FileJson, FileText, Folder, Plus, Trash2 } from "lucide-react";

export interface MockFile {
	id: string;
	path: string;
	name: string;
	type: "file" | "directory";
	language?: string;
}

const initialFiles: MockFile[] = [
	{ id: "1", path: "server", name: "server", type: "directory" },
	{ id: "2", path: "server/index.ts", name: "index.ts", type: "file", language: "typescript" },
	{ id: "3", path: "client", name: "client", type: "directory" },
	{ id: "4", path: "client/App.tsx", name: "App.tsx", type: "file", language: "typescript" },
	{ id: "5", path: "package.json", name: "package.json", type: "file", language: "json" },
	{ id: "6", path: "CLAUDE.md", name: "CLAUDE.md", type: "file", language: "markdown" },
];

export default function FileExplorer() {
	const [activeId, setActiveId] = useState<string>("4");
	const [files] = useState<MockFile[]>(initialFiles);

	const getIcon = (file: MockFile) => {
		if (file.type === "directory") return <Folder size={16} className="text-blue-400" />;
		if (file.language === "typescript") return <FileCode size={16} className="text-yellow-400" />;
		if (file.language === "json") return <FileJson size={16} className="text-green-400" />;
		return <FileText size={16} className="text-gray-400" />;
	};

	const getIndent = (path: string) => {
		const depth = path.split("/").length - 1;
		return `${depth}rem`;
	};

	return (
		<div className="flex flex-col h-full bg-[#09090b] text-[#c9d1d9] text-sm">
			<div className="flex items-center justify-between p-3 border-b border-[#27272a] shrink-0">
				<h2 className="font-semibold text-xs tracking-wider uppercase text-gray-400">Explorer</h2>
				<div className="flex gap-2">
					<button className="p-1 hover:bg-[#18181b] rounded transition-colors text-gray-400 hover:text-white">
						<Plus size={14} />
					</button>
                    <button className="p-1 hover:bg-[#18181b] rounded transition-colors text-gray-400 hover:text-red-400">
						<Trash2 size={14} />
					</button>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto py-2">
				{files.map((file) => (
					<div
						key={file.id}
						onClick={() => setActiveId(file.id)}
						className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none transition-colors border-l-2 ${
							activeId === file.id
								? "bg-[#18181b] border-blue-500 text-white"
								: "border-transparent hover:bg-[#18181b] text-gray-300 hover:text-white"
						}`}
						style={{ paddingLeft: `calc(0.75rem + ${getIndent(file.path)})` }}
					>
						{getIcon(file)}
						<span className="truncate">{file.name}</span>
					</div>
				))}
			</div>
		</div>
	);
}
