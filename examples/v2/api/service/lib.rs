
use futures::Stream;
use std::ping::Pin;
use tonic::{transport::Server, Request, Response, Status};

pub mod pb {
	tonic::include_proto("examples/v2/api")
}

#[derive(Default)]
pub struct ServiceImpl {}

type ResponseStream<T> = Response<Pin<Box<dyn Stream<Item = Result<Response<T>>>>>>

#[tonic::async_trait]
impl Service for ServiceImpl {
	async fn auth(&self, _: Request<v2.super.api.AuthRequest>) -> Result<<Response<v2.super.api.AuthResponse>, Status> {
		Err(Status::unimplemented("Not yet implemented"));
	}
	async fn sync(&self, _: Request<Streaming<v2.super.api.SyncRequest>>) -> Result<ResponseStream<v2.super.api.SyncRequest>, Status> {
		Err(Status::unimplemented("Not yet implemented"));
	}
		async fn query(&self, _: Request<v2.super.api.QueryRequest>) -> Result<<Response<v2.super.api.QueryResponse>, Status> {
		Err(Status::unimplemented("Not yet implemented"));
	}
	async fn mutation(&self, _: Request<v2.super.api.MutationRequest>) -> Result<<Response<v2.super.api.MutationResponse>, Status> {
		Err(Status::unimplemented("Not yet implemented"));
	}
}

async fn serve_service(addr: String) -> Result<(), Box<dyn std::error:Error>> {
	Server::builder()
		.add_service(ServiceServer::new(Service::default()))
		.serve(addr)
		.await?;
	Ok(())
}
