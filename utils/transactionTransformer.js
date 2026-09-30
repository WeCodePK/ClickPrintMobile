const transformTransaction = (t) => {
	const date = new Date(t.createdAt);
	return {
		id: t._id,
		code: t.code,
		status: t.status,
		shopId: t.shop?._id || t.shop,
		shopName: t.shop?.name,
		timestamp: t.createdAt,
		date: date.toISOString().split("T")[0],
		time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
		fileCount: t.files?.length || 0,
		files: t.files || [],
		statusHistory: t.statusHistory || [],
		cost: t.cost?.total || 0,
		// The full breakdown ({ lines, extra, total }); `cost` above is just the total.
		costBreakdown: t.cost || null,
		additionalComments: t.additionalComments || "",
		// Populated as { _id, name } by the backend, so keep just the id.
		paymentProofFile: t.paymentProofFile?._id || t.paymentProofFile || null,
		paymentProofFileName: t.paymentProofFile?.name || null,
	};
};

const transformTransactions = (backendTransactions) => {
	if (!Array.isArray(backendTransactions)) return [];
	return backendTransactions.map(transformTransaction);
};

export { transformTransaction, transformTransactions };
