"use client";
import { useRef } from "react";

export function UiAvatar(props: { userName: string }) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleAvatarClick = () => {
		fileInputRef.current?.click();
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
			className="absolute flex items-center justify-center min-w-20 max-w-36 p-2 aspect-square rounded-full bg-gray-600 hover:bg-gray-700 shadow-lg cursor-pointer"
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
