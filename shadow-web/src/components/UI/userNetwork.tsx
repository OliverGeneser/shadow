"use client";
import { useEffect, useRef, useState } from "react";
import { UiAvatar } from "./avatar";

type User = {
	id: number;
	userName: string;
};

export function UiUserNetwork(props: { me: User; users: User[] }) {
	const boxRef = useRef<HTMLDivElement>(null);
	const [centerX, setCenterX] = useState(0);
	const [centerY, setCenterY] = useState(0);
	const [minRadius, setMinRadius] = useState(0);
	const [maxRadius, setMaxRadius] = useState(0);
	const [avatarMaxRadius, setAvatarMaxRadius] = useState(0);

	const userPositions = props.users.map((user, index) => {
		const angleOffset = Math.random() * 0.3;
		const angle =
			-Math.PI / 2 + (index / props.users.length) * 2 * Math.PI + angleOffset;
		const radius = minRadius + Math.random() * (maxRadius - minRadius);

		const x = centerX + radius * Math.cos(angle);
		const y = centerY + radius * Math.sin(angle);

		return { ...user, x, y };
	});

	useEffect(() => {
		if (boxRef.current === null) return;
		const tempCenterX = boxRef.current.clientWidth / 2;
		const tempCenterY = boxRef.current.clientHeight / 2;
		const tempRadius = tempCenterX > tempCenterY ? tempCenterY : tempCenterX;
		const tempAvatarRadius = tempRadius / 7;

		setCenterX(tempCenterX);
		setCenterY(tempCenterY);
		setMinRadius(tempAvatarRadius * 2.2);
		setMaxRadius(tempRadius - tempAvatarRadius);
		setAvatarMaxRadius(tempAvatarRadius);
	}, [boxRef.current?.clientHeight, boxRef.current?.clientWidth]);

	return (
		<div
			className="relative w-full h-full flex items-center justify-center"
			ref={boxRef}
		>
			{centerX > 0 && centerY > 0 && boxRef.current ? (
				<>
					<svg
						className="absolute w-full h-full"
						viewBox={`0 0 ${boxRef.current.clientWidth} ${boxRef.current.clientHeight}`}
					>
						{userPositions.map((user) => (
							<line
								key={user.id}
								x1={centerX}
								y1={centerY}
								x2={user.x}
								y2={user.y}
								stroke="white"
								strokeWidth="1"
							/>
						))}
					</svg>

					<UiAvatar
						userName={props.me.userName}
						disabled
						style={{
							maxWidth: avatarMaxRadius * 2,
							minWidth: avatarMaxRadius * 1.5,
							fontSize: avatarMaxRadius / 4,
						}}
					/>

					{userPositions.map((user) => (
						<UiAvatar
							key={user.id}
							userName={user.userName}
							style={{
								maxWidth: avatarMaxRadius * 2,
								minWidth: avatarMaxRadius,
								fontSize: avatarMaxRadius / 4,
								left: user.x,
								top: user.y,
								transform: "translate(-50%,-50%)",
							}}
						/>
					))}
				</>
			) : null}
		</div>
	);
}
