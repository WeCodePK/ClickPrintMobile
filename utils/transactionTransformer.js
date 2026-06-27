const transformTransaction = (t) => {
	const date = new Date(t.createdAt);
	return {
		id: t._id,
		status: t.status,
		shopId: t.forShop,
		timestamp: t.createdAt,
		date: date.toISOString().split("T")[0],
		time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
		fileCount: t.files?.length || 0,
		files: t.files || [],
		statusHistory: t.statusHistory || [],
	};
};

const transformTransactions = (backendTransactions) => {
	if (!Array.isArray(backendTransactions)) return [];
	return backendTransactions.map(transformTransaction);
};

export { transformTransaction, transformTransactions };
