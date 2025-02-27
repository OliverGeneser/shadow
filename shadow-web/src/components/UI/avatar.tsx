"use client";
import { useRef } from "react";

export function UiAvatar(props: {
	userName: string;
	disabled?: boolean;
	className?: string;
	style?: React.CSSProperties;
}) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarClick = () => {
		!props.disabled && fileInputRef.current?.click();
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (files && files.length > 0) {
			console.log("Selected files:", files);
			//Todo transfer files
		}
	};

	return (
		<div
			className={`absolute flex items-center justify-center overflow-hidden min-w-20 max-w-36 p-2 aspect-square rounded-full shadow-lg ${
				props.disabled
					? "bg-blue-500"
					: "bg-gray-600 hover:bg-gray-700 cursor-pointer"
			} ${props.className}`}
			style={props.style}
			onClick={handleAvatarClick}
		>
			<span className="font-medium text-gray-100 text-center break-words">
				{props.userName}
			</span>
			<input
				type="file"
				className="hidden"
				ref={fileInputRef}
				onChange={handleFileChange}
				multiple
			/>
		</div>
	);
}
